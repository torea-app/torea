import { ERROR_MESSAGES } from "../lib/constants";

/** マイクエラーコード → ユーザー向けメッセージのマッピング */
function getMicErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return ERROR_MESSAGES.MIC_PERMISSION_DENIED;
      case "NotFoundError":
        return ERROR_MESSAGES.MIC_NOT_FOUND;
      case "NotReadableError":
        return ERROR_MESSAGES.MIC_IN_USE;
    }
  }
  return ERROR_MESSAGES.MIC_PERMISSION_DENIED;
}

export type AudioMixerResult = {
  /** ミキシングされた音声ストリーム（MediaRecorder に渡す） */
  mixedStream: MediaStream;
  /** リソース解放関数 */
  cleanup: () => void;
};

/**
 * タブ音声とマイク音声を Web Audio API でミキシングする。
 *
 * - タブ音声: tabCapture で取得した MediaStream の音声トラック
 * - マイク音声: getUserMedia で取得（ハイパスフィルター + ダイナミクスコンプレッサー付き）
 * - 両方を MediaStreamDestination に接続し、1つの MediaStream として出力
 */
export async function createAudioMixer(
  tabStream: MediaStream,
  micEnabled: boolean,
): Promise<AudioMixerResult> {
  const audioContext = new AudioContext();

  // Offscreen Document はユーザーインタラクションのない文脈で実行されるため、
  // ブラウザが AudioContext を "suspended" 状態で作成することがある。
  // resume() を明示的に呼ばないと音声が録音されないため、ここで確認する。
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const destination = audioContext.createMediaStreamDestination();

  // --- タブ音声 ---
  // Chrome の tabCapture はキャプチャした音声をスピーカー出力から「奪う」ため、
  // 録画用の destination に加えて audioContext.destination（スピーカー）にも接続し、
  // ユーザーが録画中も音声を聞けるようにする。
  const tabAudioTracks = tabStream.getAudioTracks();
  if (tabAudioTracks.length > 0) {
    const tabAudioStream = new MediaStream(tabAudioTracks);
    const tabSource = audioContext.createMediaStreamSource(tabAudioStream);
    const tabGain = audioContext.createGain();
    tabGain.gain.value = 1.0;
    tabSource.connect(tabGain);
    tabGain.connect(destination);
    tabGain.connect(audioContext.destination);
  }

  // --- マイク音声 ---
  let micStream: MediaStream | null = null;
  if (micEnabled) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (error) {
      audioContext.close();
      throw new Error(getMicErrorMessage(error));
    }

    const micSource = audioContext.createMediaStreamSource(micStream);

    // ハイパスフィルター: 80Hz 以下のノイズを除去
    const highpassFilter = audioContext.createBiquadFilter();
    highpassFilter.type = "highpass";
    highpassFilter.frequency.value = 80;

    // ダイナミクスコンプレッサー: 音量の均一化
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 4;
    compressor.knee.value = 10;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const micGain = audioContext.createGain();
    micGain.gain.value = 1.0;

    micSource
      .connect(highpassFilter)
      .connect(compressor)
      .connect(micGain)
      .connect(destination);
  }

  function cleanup() {
    for (const track of micStream?.getTracks() ?? []) {
      track.stop();
    }
    audioContext.close();
  }

  return {
    mixedStream: destination.stream,
    cleanup,
  };
}

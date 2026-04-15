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
 * マイク無効時は AudioContext を使わず、タブ音声をそのまま返す。
 * Chrome の tabCapture はキャプチャした音声をスピーカー出力から「奪う」ため、
 * Audio 要素でスピーカー再生を復元する。
 *
 * マイク有効時は Web Audio API で両方をミキシングし、
 * マイク音声にはハイパスフィルター + ダイナミクスコンプレッサーを適用する。
 */
export async function createAudioMixer(
  tabStream: MediaStream,
  micEnabled: boolean,
): Promise<AudioMixerResult> {
  // --- マイク無効: AudioContext 不要の軽量パス ---
  if (!micEnabled) {
    return createTabOnlyMixer(tabStream);
  }

  // --- マイク有効: Web Audio API でミキシング ---
  return createFullMixer(tabStream);
}

/**
 * マイク無効時の軽量ミキサー。
 * AudioContext を生成せず、Audio 要素でタブ音声をスピーカーに戻す。
 */
function createTabOnlyMixer(tabStream: MediaStream): AudioMixerResult {
  const tabAudioTracks = tabStream.getAudioTracks();

  // タブ音声をスピーカーに戻す（tabCapture が奪った音声を復元）
  let playbackAudio: HTMLAudioElement | null = null;
  if (tabAudioTracks.length > 0) {
    playbackAudio = new Audio();
    playbackAudio.srcObject = new MediaStream(tabAudioTracks);
    playbackAudio.play().catch(() => {
      // Offscreen Document で自動再生がブロックされた場合は無視
    });
  }

  return {
    mixedStream: new MediaStream(tabAudioTracks),
    cleanup() {
      if (playbackAudio) {
        playbackAudio.pause();
        playbackAudio.srcObject = null;
        playbackAudio = null;
      }
    },
  };
}

/**
 * マイク有効時のフルミキサー。
 * Web Audio API でタブ音声 + マイク音声をミキシングする。
 */
async function createFullMixer(
  tabStream: MediaStream,
): Promise<AudioMixerResult> {
  const audioContext = new AudioContext();

  // Offscreen Document はユーザーインタラクションのない文脈で実行されるため、
  // ブラウザが AudioContext を "suspended" 状態で作成することがある。
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const destination = audioContext.createMediaStreamDestination();

  // --- タブ音声 ---
  const tabAudioTracks = tabStream.getAudioTracks();
  if (tabAudioTracks.length > 0) {
    const tabAudioStream = new MediaStream(tabAudioTracks);
    const tabSource = audioContext.createMediaStreamSource(tabAudioStream);
    // タブ音声は録画用 destination + スピーカーの両方に接続
    tabSource.connect(destination);
    tabSource.connect(audioContext.destination);
  }

  // --- マイク音声 ---
  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // タブ音声がスピーカー → マイクに回り込むのを Chrome AEC で除去する。
        // false にするとタブ音声が録画に2重で混入し「重なった音」になる。
        echoCancellation: true,
        // 環境ノイズ（キーボード打鍵音、エアコン等）を低減する。
        noiseSuppression: true,
        // ポンピング効果（音量が不自然に上下する）を防ぐため無効のまま。
        // マイクゲインは compressor で均一化する。
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

  micSource.connect(highpassFilter).connect(compressor).connect(destination);

  return {
    mixedStream: destination.stream,
    cleanup() {
      for (const track of micStream?.getTracks() ?? []) {
        track.stop();
      }
      audioContext.close();
    },
  };
}

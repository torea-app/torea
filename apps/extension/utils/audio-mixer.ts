import { ERROR_MESSAGES } from "../lib/constants";
import type { RecordingMode } from "../types/recording";

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
  /** ミキシングされた音声ストリーム（MediaRecorder に渡す）。
   * 入力ソースの有無に関わらず必ず 1 本の audio track を含む。
   * ソースが無いケースでは ConstantSourceNode による無音が流れる。 */
  mixedStream: MediaStream;
  /** リソース解放関数 */
  cleanup: () => void;
};

/**
 * キャプチャ音声とマイク音声を Web Audio API でミキシングする。
 *
 * 設計上の重要な保証:
 * - 戻り値の mixedStream は **必ず 1 本の audio track を含む**。
 *   これは MediaRecorder がストリーム構成を録画開始時にロックする仕様への対策。
 *   audio track 0 本でレコードすると MP4 に audio ストリームが書かれず、
 *   後段の ffmpeg `-vn` 処理（音声抽出）が "Output file does not contain any stream"
 *   で失敗する。display モードで window ソースを選んだケースなど、
 *   getDisplayMedia が audio を 0 本返す状況でこの問題が顕在化したため、
 *   常に AudioContext.destination 経由で 1 本の audio track を構成する。
 * - AudioContext のグラフが完全に空だとブラウザが処理をスケジュールしない可能性が
 *   あるため、ConstantSourceNode（offset=0）を destination に常時接続する。
 *   これで明示的に「無音の継続的サンプル」が destination に流れる。
 *
 * モード差:
 * - "tab": tabCapture はキャプチャした音声をスピーカー出力から「奪う」ため、
 *   capture 音声を AudioContext.destination（スピーカー）にも繋いで再生を復元する。
 * - "display": getDisplayMedia の音声はスピーカー出力を「奪わない」ため、
 *   復元接続を作るとシステム上で音が二重再生される。よって流さない。
 */
export async function createAudioMixer(
  captureStream: MediaStream,
  micEnabled: boolean,
  mode: RecordingMode,
): Promise<AudioMixerResult> {
  const audioContext = new AudioContext();

  // Offscreen Document はユーザーインタラクションのない文脈で実行されるため、
  // ブラウザが AudioContext を "suspended" 状態で作成することがある。
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const destination = audioContext.createMediaStreamDestination();

  // --- 無音アンカー: グラフが空でも継続的に audio フレームが destination に流れることを保証 ---
  // ConstantSourceNode は offset=0 だと PCM 0（完全な無音）を出力する。
  // これを destination に常時接続することで、ソースが何も無い状況でも
  // MediaStreamTrack が "live" のまま無音サンプルを生成し続ける。
  const silentAnchor = audioContext.createConstantSource();
  silentAnchor.offset.value = 0;
  silentAnchor.connect(destination);
  silentAnchor.start();

  // --- キャプチャ音声 ---
  const captureAudioTracks = captureStream.getAudioTracks();
  if (captureAudioTracks.length > 0) {
    const captureAudioStream = new MediaStream(captureAudioTracks);
    const captureSource =
      audioContext.createMediaStreamSource(captureAudioStream);
    // 録画用 destination には常に流す
    captureSource.connect(destination);
    // tab モードのみスピーカー出力にも流して再生を復元
    // (display モードでスピーカーに流すと PC で音が二重再生される)
    if (mode === "tab") {
      captureSource.connect(audioContext.destination);
    }
  }

  // --- マイク音声 ---
  let micStream: MediaStream | null = null;
  if (micEnabled) {
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
      try {
        silentAnchor.stop();
      } catch {
        // 既に停止済みなら無視
      }
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
  }

  return {
    mixedStream: destination.stream,
    cleanup() {
      try {
        silentAnchor.stop();
      } catch {
        // 既に停止済み（cleanup の二重呼び出しなど）は無視
      }
      for (const track of micStream?.getTracks() ?? []) {
        track.stop();
      }
      audioContext.close();
    },
  };
}

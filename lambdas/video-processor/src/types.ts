export interface TranscribeRequest {
  r2Key: string;
  recordingId: string;
  language?: string;
  model?: string;
}

export interface TranscribeResponse {
  success: true;
  recordingId: string;
  language: string;
  duration: number;
  fullText: string;
  segments: Segment[];
  model: string;
  chunkCount: number;
  processingTime: number;
}

export interface TranscribeErrorResponse {
  success: false;
  error: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface ChunkResult {
  chunkIndex: number;
  chunkStartSec: number;
  segments: GroqSegment[];
}

export interface SplitResult {
  chunkPaths: string[];
  chunkStartsSec: number[];
  totalDuration: number;
}

export interface GroqSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
  compression_ratio: number;
}

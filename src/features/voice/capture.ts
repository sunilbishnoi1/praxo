import { calculateRms, dbFromRms, isSpeaking } from "./vad";

export type CaptureLevel = {
  rms: number;
  db: number;
  speaking: boolean;
};

export type VoiceCaptureController = {
  stream: MediaStream;
  audioContext: AudioContext;
  analyser: AnalyserNode;
  mediaRecorder: MediaRecorder;
  stop: () => void;
  dispose: () => void;
};

export type VoiceCaptureOptions = {
  onLevel?: (sample: CaptureLevel) => void;
  onChunk?: (chunk: Blob) => void;
  onRecorderStateChange?: (state: RecordingState) => void;
};

function selectRecorderMimeType(): string | undefined {
  const supportedTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return supportedTypes.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

export async function createVoiceCapture(
  options: VoiceCaptureOptions = {}
): Promise<VoiceCaptureController> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  sourceNode.connect(analyser);

  const mimeType = selectRecorderMimeType();
  const mediaRecorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined
  );

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      options.onChunk?.(event.data);
    }
  });

  mediaRecorder.addEventListener("start", () => {
    options.onRecorderStateChange?.(mediaRecorder.state);
  });
  mediaRecorder.addEventListener("stop", () => {
    options.onRecorderStateChange?.(mediaRecorder.state);
  });

  const buffer = new Float32Array(analyser.fftSize);
  let rafId = 0;
  const tick = (): void => {
    analyser.getFloatTimeDomainData(buffer);
    const rms = calculateRms(buffer);
    options.onLevel?.({
      rms,
      db: dbFromRms(rms),
      speaking: isSpeaking(rms),
    });
    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);
  mediaRecorder.start(250);

  return {
    stream,
    audioContext,
    analyser,
    mediaRecorder,
    stop(): void {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      stream.getTracks().forEach((track) => track.stop());
      window.cancelAnimationFrame(rafId);
      void audioContext.close();
    },
    dispose(): void {
      stream.getTracks().forEach((track) => track.stop());
      window.cancelAnimationFrame(rafId);
      void audioContext.close();
    },
  };
}

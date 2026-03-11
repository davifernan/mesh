type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

export function getFullscreenElement(doc: Document = document): Element | null {
  const fullscreenDoc = doc as FullscreenDocument;
  return fullscreenDoc.fullscreenElement ?? fullscreenDoc.webkitFullscreenElement ?? null;
}

export function isElementFullscreen(element: Element | null, doc: Document = document): boolean {
  return !!element && getFullscreenElement(doc) === element;
}

export function addFullscreenListeners(doc: Document, onChange: () => void): () => void {
  doc.addEventListener('fullscreenchange', onChange);
  doc.addEventListener('webkitfullscreenchange', onChange as EventListener);

  return () => {
    doc.removeEventListener('fullscreenchange', onChange);
    doc.removeEventListener('webkitfullscreenchange', onChange as EventListener);
  };
}

export async function exitFullscreen(doc: Document = document): Promise<void> {
  const fullscreenDoc = doc as FullscreenDocument;
  if (fullscreenDoc.exitFullscreen) {
    await fullscreenDoc.exitFullscreen();
    return;
  }
  if (fullscreenDoc.webkitExitFullscreen) {
    await fullscreenDoc.webkitExitFullscreen();
  }
}

export async function requestElementFullscreen(element: HTMLElement): Promise<boolean> {
  const fullscreenElement = element as FullscreenElement;
  if (fullscreenElement.requestFullscreen) {
    await fullscreenElement.requestFullscreen();
    return true;
  }
  if (fullscreenElement.webkitRequestFullscreen) {
    await fullscreenElement.webkitRequestFullscreen();
    return true;
  }
  return false;
}

export function enterVideoFullscreen(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  const fullscreenVideo = video as FullscreenVideoElement;
  if (fullscreenVideo.webkitEnterFullscreen) {
    fullscreenVideo.webkitEnterFullscreen();
    return true;
  }
  return false;
}

export function isVideoFullscreen(video: HTMLVideoElement | null): boolean {
  if (!video) return false;
  return !!(video as FullscreenVideoElement).webkitDisplayingFullscreen;
}

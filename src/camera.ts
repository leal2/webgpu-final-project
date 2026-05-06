export interface Camera {
    x: number;
    y: number;
    zoom: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
}

export function createCamera(): Camera {
    return {
        x: 0,
        y: 0,
        zoom: 2.0,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0
    };
}

export function setupCameraControls(canvas: HTMLCanvasElement, camera: Camera, callback: () => void): void {
    canvas.addEventListener("mousedown", (e) => {
        camera.isDragging = true;
        camera.lastMouseX = e.clientX;
        camera.lastMouseY = e.clientY;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (camera.isDragging) {
            const dx = e.clientX - camera.lastMouseX;
            const dy = e.clientY - camera.lastMouseY;
            camera.x -= (dx / canvas.width) * 2 * camera.zoom;
            camera.y += (dy / canvas.height) * 2 * camera.zoom;
            camera.lastMouseX = e.clientX;
            camera.lastMouseY = e.clientY;
            callback();
        }
    });

    window.addEventListener("mouseup", () => camera.isDragging = false);

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        camera.zoom *= e.deltaY > 0 ? 1.1 : 0.9;
        camera.zoom = Math.max(0.1, Math.min(10, camera.zoom));
        callback();
    }, { passive: false });
}
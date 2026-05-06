// Camera state and utility functions
export interface Camera {
    x: number;
    y: number;
    zoom: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
  }
  
  export interface CanvasDimensions {
    width: number;
    height: number;
    rect: DOMRect;
  }
  
  export interface Point {
    x: number;
    y: number;
  }
  
  export function createCamera(): Camera {
    return {
      x: 0,
      y: 0,
      zoom: 1.0,
      isDragging: false,
      lastMouseX: 0,
      lastMouseY: 0
    };
  }
  
  // Get canvas dimensions
  export function getCanvasDimensions(canvas: HTMLCanvasElement): CanvasDimensions {
    return { 
      width: canvas.width, 
      height: canvas.height,
      rect: canvas.getBoundingClientRect()
    };
  }
  
  // Convert screen coordinates to canvas coordinates
  export function getCanvasCoordinates(
    screenX: number, 
    screenY: number, 
    canvas: HTMLCanvasElement
  ): Point {
    const dimensions = getCanvasDimensions(canvas);
    const rect = dimensions.rect;
    
    return {
      x: screenX - rect.left,
      y: screenY - rect.top
    };
  }
  
  // Convert canvas coordinates to normalized device coordinates (-1 to 1)
  export function canvasToNDC(
    canvasX: number, 
    canvasY: number, 
    canvas: HTMLCanvasElement
  ): Point {
    const dimensions = getCanvasDimensions(canvas);
    
    return {
      x: (canvasX / dimensions.width) * 2 - 1,
      y: -((canvasY / dimensions.height) * 2 - 1) // Flip Y axis
    };
  }
  
  // Convert normalized device coordinates to world coordinates
  export function ndcToWorld(
    ndcX: number, 
    ndcY: number, 
    camera: Camera
  ): Point {
    return {
      x: ndcX * camera.zoom + camera.x,
      y: ndcY * camera.zoom + camera.y
    };
  }
  
  // Convert screen coordinates to world coordinates
  export function screenToWorld(
    screenX: number, 
    screenY: number, 
    camera: Camera, 
    canvas: HTMLCanvasElement
  ): Point {
    const canvasCoords = getCanvasCoordinates(screenX, screenY, canvas);
    const ndcCoords = canvasToNDC(canvasCoords.x, canvasCoords.y, canvas);
    return ndcToWorld(ndcCoords.x, ndcCoords.y, camera);
  }
  
  // Setup camera event listeners
  export function setupCameraControls(
    canvas: HTMLCanvasElement, 
    camera: Camera, 
    updateCameraCallback: () => void
  ): void {
    canvas.addEventListener("mousedown", (e: MouseEvent) => {
      camera.isDragging = true;
      const canvasCoords = getCanvasCoordinates(e.clientX, e.clientY, canvas);
      camera.lastMouseX = canvasCoords.x;
      camera.lastMouseY = canvasCoords.y;
    });
  
    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      if (camera.isDragging) {
        // Get canvas-relative coordinates
        const canvasCoords = getCanvasCoordinates(e.clientX, e.clientY, canvas);
        
        // Calculate the change in mouse position within canvas
        const dx = canvasCoords.x - camera.lastMouseX;
        const dy = canvasCoords.y - camera.lastMouseY;
        
        // Convert pixel movement to world space movement (accounting for zoom)
        const dimensions = getCanvasDimensions(canvas);
        const worldDx = (dx / dimensions.width) * 2 * camera.zoom;
        const worldDy = -(dy / dimensions.height) * 2 * camera.zoom; // Flip Y
        
        // Update camera position
        camera.x -= worldDx;
        camera.y -= worldDy;
        
        // Update last mouse position
        camera.lastMouseX = canvasCoords.x;
        camera.lastMouseY = canvasCoords.y;
        
        updateCameraCallback();
      }
    });
  
    canvas.addEventListener("mouseup", () => {
      camera.isDragging = false;
    });
  
    canvas.addEventListener("mouseleave", () => {
      camera.isDragging = false;
    });
  
    // Improved zoom that zooms toward cursor position
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      
      // Get world position under the cursor before zoom
      const mouseWorldPos = screenToWorld(e.clientX, e.clientY, camera, canvas);
      
      // Adjust zoom based on scroll direction
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; // Zoom out/in
      camera.zoom *= zoomFactor;
      
      // Clamp zoom to reasonable limits
      camera.zoom = Math.max(0.1, Math.min(10.0, camera.zoom));
      
      // Get new world position under cursor after zoom change
      const newMouseWorldPos = screenToWorld(e.clientX, e.clientY, camera, canvas);
      
      // Adjust camera position to keep cursor over the same world point
      camera.x += (mouseWorldPos.x - newMouseWorldPos.x);
      camera.y += (mouseWorldPos.y - newMouseWorldPos.y);
      
      updateCameraCallback();
    }, { passive: false });
  }
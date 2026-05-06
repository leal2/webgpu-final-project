import shaderCode from "./triangle.wgsl";
import { 
    createCamera, 
    setupCameraControls 
} from "./camera";

async function main() {
    // Request an adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    // Configure rendering context
    const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
    const context = canvas.getContext("webgpu") as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
    });

    // Initialize camera
    const camera = createCamera();

    // Triangle interface
    interface Triangle {
        x: number;
        y: number;
        color: number[];
    }
    const triangleCountInput = document.getElementById("triangle-count") as HTMLInputElement;
    const triangleCountValue = document.getElementById("triangle-count-value") as HTMLSpanElement;
    const maxTriangles = Math.max(1, Math.floor(Number(triangleCountInput.max) || 100));
    const getTriangleCount = (): number => {
        const rawCount = Math.floor(Number(triangleCountInput.value) || 1);
        const clampedCount = Math.min(maxTriangles, Math.max(1, rawCount));

        // Keep the slider state aligned with enforced bounds.
        if (clampedCount !== rawCount) {
            triangleCountInput.value = String(clampedCount);
        }

        return clampedCount;
    };
    let triangleBuffer : GPUBuffer;

    // Generate random triangles based on selected count
    function generateTriangles(count: number) {
        const triangles = Array.from({ length: count }, () => ({
            x: Math.random() * 1.2 - 0.6,
            y: Math.random() * 1.2 - 0.6,
            color: [
                Math.random(),
                Math.random(),
                Math.random(),
                1.0
            ]
        }));
        
        return triangles;
    }

    // Set up triangle data
    function updateTriangleBuffer(triangles : Triangle[], device : GPUDevice) {
        const triangleData = new Float32Array(maxTriangles * 8);
        triangles.forEach((triangle : Triangle, i : number) => {
            const offset = i * 8;
            triangleData[offset] = triangle.x;
            triangleData[offset + 1] = triangle.y;
            triangleData[offset + 2] = 0.0;
            triangleData[offset + 3] = 0.0;
            triangleData[offset + 4] = triangle.color[0];
            triangleData[offset + 5] = triangle.color[1];
            triangleData[offset + 6] = triangle.color[2];
            triangleData[offset + 7] = triangle.color[3];
        });
        if (triangleBuffer) {
            device.queue.writeBuffer(triangleBuffer, 0, triangleData);
        } else {
            triangleBuffer = device.createBuffer({
                size: triangleData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(triangleBuffer.getMappedRange()).set(triangleData);
            triangleBuffer.unmap();
        }
        return triangleBuffer;
    }

    let triangles = generateTriangles(getTriangleCount());
    triangleBuffer = updateTriangleBuffer(triangles, device);

    // Keep the slider label in sync with the rendered triangle count.
    triangleCountValue.textContent = String(triangles.length);

    triangleCountInput.addEventListener("input", () => {
        const count = getTriangleCount();
        triangleCountValue.textContent = String(count);
        triangles = generateTriangles(count);
        updateTriangleBuffer(triangles, device);
    });

    // Add event listener for randomize button
    document.getElementById("randomize-btn").addEventListener("click", () => {
        triangles = generateTriangles(getTriangleCount());
        updateTriangleBuffer(triangles, device);
    });

    // Create a uniform buffer for camera data
    // We need 3 float32 values (12 bytes) but must align to 16 bytes for WebGPU
    const cameraUniformBuffer = device.createBuffer({
        size: 16, // Properly aligned size for 3 floats (x, y, zoom)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Update camera uniforms
    function updateCameraUniform(): void {
        device.queue.writeBuffer(
        cameraUniformBuffer,
        0,
        new Float32Array([camera.x, camera.y, camera.zoom, 0.0]) // Add padding for alignment
        );
    }

    updateCameraUniform();
    setupCameraControls(canvas, camera, updateCameraUniform);

    // Create bind group layout (now with camera uniform buffer)
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: "read-only-storage" }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        }
        ]
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
        {
            binding: 0,
            resource: { buffer: triangleBuffer }
        },
        {
            binding: 1,
            resource: { buffer: cameraUniformBuffer }
        }
        ]
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });

    // Create pipeline
    const pipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
        }),
        vertex: {
        module: shaderModule,
        entryPoint: "vertexMain"
        },
        fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format }]
        }
    });

    // Render function
    function render(): void {
        
        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }
        }]
        });
        
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3, triangles.length); // 3 vertices per triangle
        pass.end();
        
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }

    render();
}

window.addEventListener("load", main);
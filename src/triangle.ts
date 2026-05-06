import shaderCode from "./simulation.wgsl";
import { createCamera, setupCameraControls } from "./camera";

async function init() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = (await adapter?.requestDevice())!;
    const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
    const context = canvas.getContext("webgpu")!;
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format });

    const camera = createCamera();
    camera.zoom = 3.5; // Initial zoom for the 3x play area
    
    const inputs = {
        circle: document.getElementById("circle-count") as HTMLInputElement,
        tri: document.getElementById("tri-count") as HTMLInputElement,
        star: document.getElementById("star-count") as HTMLInputElement,
        gravity: document.getElementById("gravity-toggle") as HTMLInputElement,
    };

    // Updated Struct: pos(8), vel(8), col(16), size(4), kind(4), rot(4), angVel(4), rest(4), pad(8) = 64 bytes
    const particleBuffer = device.createBuffer({
        size: 3000 * 64, 
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    let currentParticleCount = 0;

    function createParticles() {
        const counts = [parseInt(inputs.circle.value), parseInt(inputs.tri.value), parseInt(inputs.star.value)];
        currentParticleCount = counts.reduce((a, b) => a + b, 0);
        
        const data = new Float32Array(3000 * 16); // 64 bytes / 4 = 16 floats
        let offset = 0;

        counts.forEach((count, kind) => {
            for (let i = 0; i < count; i++) {
                const idx = offset * 16;
                data[idx] = Math.random() * 10 - 5;      // x
                data[idx + 1] = Math.random() * 10 - 5;  // y
                data[idx + 2] = (Math.random() * 2 - 1) * 0.8; // vel x
                data[idx + 3] = (Math.random() * 2 - 1) * 0.8; // vel y
                data[idx + 4] = Math.random();          // r
                data[idx + 5] = Math.random();          // g
                data[idx + 6] = Math.random();          // b
                data[idx + 7] = 1.0;                    // a
                data[idx + 8] = 0.04 + Math.random() * 0.08; // size
                data[idx + 9] = kind;                   // kind
                data[idx + 10] = Math.random() * 6.28;  // rotation
                data[idx + 11] = (Math.random() * 2 - 1) * 2.0; // angularVel
                data[idx + 12] = 0.4 + Math.random() * 0.5;    // restitution (bounciness)
                offset++;
            }
        });

        device.queue.writeBuffer(particleBuffer, 0, data);
        document.getElementById("circle-val")!.textContent = inputs.circle.value;
        document.getElementById("tri-val")!.textContent = inputs.tri.value;
        document.getElementById("star-val")!.textContent = inputs.star.value;
    }

    const simParamsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const cameraBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = device.createShaderModule({ code: shaderCode });

    // (Layout and Pipeline code from previous turn remains identical, 
    // but ensured bindGroupLayout matches the vertex shader's bindings)
    const computeLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
        ]
    });

    const renderLayout = device.createBindGroupLayout({
        entries: [
            { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            { binding: 3, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }
        ]
    });

    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
        compute: { module: shaderModule, entryPoint: "computeMain" }
    });

    const renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [renderLayout] }),
        vertex: { module: shaderModule, entryPoint: "vertexMain" },
        fragment: { module: shaderModule, entryPoint: "fragmentMain", targets: [{ format }] },
        primitive: { topology: "triangle-list" }
    });

    const computeBindGroup = device.createBindGroup({
        layout: computeLayout,
        entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: simParamsBuffer } },
            { binding: 2, resource: { buffer: cameraBuffer } }
        ]
    });

    const renderBindGroup = device.createBindGroup({
        layout: renderLayout,
        entries: [
            { binding: 2, resource: { buffer: cameraBuffer } },
            { binding: 3, resource: { buffer: particleBuffer } }
        ]
    });

    function frame() {
        const gravity = inputs.gravity.checked ? 1.5 : 0.0; 
        device.queue.writeBuffer(simParamsBuffer, 0, new Float32Array([0.016, 1.0, gravity, currentParticleCount]));
        device.queue.writeBuffer(cameraBuffer, 0, new Float32Array([camera.x, camera.y, camera.zoom, 0]));

        const encoder = device.createCommandEncoder();
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(currentParticleCount / 64));
        computePass.end();

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
                loadOp: "clear", storeOp: "store",
            }]
        });
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBindGroup);
        renderPass.draw(48, currentParticleCount); 
        renderPass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }

    document.getElementById("reset-btn")!.onclick = createParticles;
    [inputs.circle, inputs.tri, inputs.star].forEach(input => input.oninput = createParticles);
    setupCameraControls(canvas, camera, () => {});

    createParticles();
    frame();
}

init();
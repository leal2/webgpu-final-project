struct Triangle {
    pos: vec2f,
    padding: vec2f,
    color: vec4f,
};

struct Camera {
    position: vec2f,
    zoom: f32,
    padding: f32,
};

@group(0) @binding(0) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(1) var<uniform> camera: Camera;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32, 
                @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
    // Triangle vertices (equilateral triangle centered at origin)
    var positions = array<vec2f, 3>(
        vec2f(0.0, 0.1),
        vec2f(-0.1, -0.1),
        vec2f(0.1, -0.1)
    );
    
    // Proper camera transform for zooming
    // 1. Apply object position (triangle center)
    // 2. Subtract camera position to move camera
    // 3. Apply zoom (divide by zoom factor to make objects appear smaller when zooming out)
    var worldPos = positions[vertexIndex] + triangles[instanceIndex].pos;
    var viewPos = (worldPos - camera.position) / camera.zoom;
    
    var output: VertexOutput;
    output.position = vec4f(viewPos, 0.0, 1.0);
    output.color = triangles[instanceIndex].color;
    
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    return input.color;
}
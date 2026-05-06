struct Particle {
    pos: vec2f,
    vel: vec2f,
    color: vec4f,
    size: f32,
    kind: f32, 
    padding: vec2f,
};

struct SimParams {
    dt: f32,
    friction: f32,
    attraction: f32, // No longer used for interaction, but kept for binding compatibility
    numParticles: f32,
};

struct Camera {
    pos: vec2f,
    zoom: f32,
};

@group(0) @binding(0) var<storage, read_write> particlesCompute: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;
@group(0) @binding(2) var<uniform> camera: Camera;
@group(0) @binding(3) var<storage, read> particlesRender: array<Particle>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (f32(i) >= params.numParticles) { return; }

    var p = particlesCompute[i];

    // Simple Linear Motion: Update position by velocity
    p.pos += p.vel * params.dt;

    // Boundary Collisions: Bounce off edges (-1 to 1 space)
    if (p.pos.x < -1.0) { 
        p.pos.x = -1.0;
        p.vel.x *= -1.0; 
    }
    if (p.pos.x > 1.0) { 
        p.pos.x = 1.0;
        p.vel.x *= -1.0; 
    }
    if (p.pos.y < -1.0) { 
        p.pos.y = -1.0;
        p.vel.y *= -1.0; 
    }
    if (p.pos.y > 1.0) { 
        p.pos.y = 1.0;
        p.vel.y *= -1.0; 
    }

    particlesCompute[i] = p;
}

struct VertexOutput {
    @builtin(position) clip_pos: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vIdx: u32, @builtin(instance_index) iIdx: u32) -> VertexOutput {
    let p = particlesRender[iIdx];
    var localPos: vec2f = vec2f(0.0);

    // Identify which triangle "slice" we are currently drawing
    let slice = vIdx / 3u;
    let step = vIdx % 3u;

    if (p.kind < 0.5) { 
        // --- SMOOTH CIRCLE (16 Slices) ---
        // Each slice: (0,0), Point A, Point B
        if (step > 0u) {
            let angle = f32(slice + (step - 1u)) * (6.28318 / 16.0);
            localPos = vec2f(cos(angle), sin(angle));
        }
    } else if (p.kind < 1.5) { 
        // --- TRIANGLE ---
        let tri = array<vec2f, 3>(vec2f(0, 0.8), vec2f(-0.7, -0.5), vec2f(0.7, -0.5));
        if (vIdx < 3u) {
            localPos = tri[vIdx];
        }
    } else { 
        // --- CORRECT 5-POINTED STAR (10 Slices) ---
        // A classic star has 10 segments (5 points, 5 inner corners)
        if (step > 0u) {
            let vertexInSlice = slice + (step - 1u);
            let isOuter = (vertexInSlice % 2u == 0u);
            
            // 0.382 is the Golden Ratio based 'pointiness' for a perfect star
            let radius = select(0.382, 1.0, isOuter);
            let angle = f32(vertexInSlice) * (6.28318 / 10.0) - (6.28318 / 4.0); // Offset to point up
            localPos = vec2f(cos(angle), sin(angle)) * radius;
        }
    }

    let worldPos = (localPos * p.size + p.pos - camera.pos) / camera.zoom;
    
    var out: VertexOutput;
    out.clip_pos = vec4f(worldPos, 0.0, 1.0);
    out.color = p.color;
    return out;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
    return in.color;
}
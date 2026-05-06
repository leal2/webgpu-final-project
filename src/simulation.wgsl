struct Particle {
    pos: vec2f,
    vel: vec2f,
    color: vec4f,
    size: f32,
    kind: f32, 
    rotation: f32,
    angularVel: f32,
    restitution: f32,
    padding: vec2f,
};

struct SimParams {
    dt: f32,
    friction: f32,
    gravity: f32, 
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

    // --- 1. MOTION & MODES ---
    // Reduced damping slightly to keep things energetic
    let linearDamping = 0.998; 
    let angularDamping = 0.97;
    p.vel *= linearDamping;
    p.angularVel *= angularDamping;

    if (params.gravity > 0.0) {
        p.vel.y -= params.gravity * params.dt;
    } else {
        let speed = length(p.vel);
        if (speed < 0.6 && speed > 0.001) {
            p.vel = normalize(p.vel) * 0.6; 
        }
    }

    p.pos += p.vel * params.dt;
    p.rotation += p.angularVel * params.dt;

    // --- 2. PHYSICS & ANTI-CLUMPING ---
    for (var j = 0u; j < u32(params.numParticles); j++) {
        if (i == j) { continue; }
        var other = particlesCompute[j];
        
        // Restore full radii so they don't visually overlap
        let collisionDist = p.size + other.size;
        let diff = p.pos - other.pos;
        let dist = length(diff);

        if (dist < collisionDist && dist > 0.0) {
            let normal = diff / dist;
            
            // SOFT PRESSURE: Decisively push apart even at rest
            // This is the "Anti-Clump" secret
            let pressure = (1.0 - (dist / collisionDist)) * 0.02;
            p.pos += normal * pressure;
            p.vel += normal * pressure;

            let relativeVel = p.vel - other.vel;
            let velocityAlongNormal = dot(relativeVel, normal);

            if (velocityAlongNormal < 0.0) {
                let e = min(p.restitution, other.restitution);
                let impulse = -(1.0 + e) * velocityAlongNormal;
                let massSum = p.size + other.size;
                p.vel += (impulse * normal * other.size) / massSum;

                // Angular Momentum
                let tangent = vec2f(-normal.y, normal.x);
                let torque = dot(relativeVel, tangent);
                p.angularVel += (torque * 0.1) / p.size;
            }
        }
    }

    // --- 3. BOUNDARIES ---
    let limit = 5.0;
    let bounceEpsilon = 0.02;
    if (abs(p.pos.x) > limit) {
        p.pos.x = sign(p.pos.x) * (limit - bounceEpsilon);
        p.vel.x *= -p.restitution;
    }
    if (abs(p.pos.y) > limit) {
        p.pos.y = sign(p.pos.y) * (limit - bounceEpsilon);
        p.vel.y *= -p.restitution;
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
    let slice = vIdx / 3u;
    let step = vIdx % 3u;

    // Define Base Geometry
    if (p.kind < 0.5) { // Circle
        if (step > 0u) {
            let angle = f32(slice + (step - 1u)) * (6.28318 / 16.0);
            localPos = vec2f(cos(angle), sin(angle));
        }
    } else if (p.kind < 1.5) { // Triangle
        let tri = array<vec2f, 3>(vec2f(0, 0.8), vec2f(-0.7, -0.5), vec2f(0.7, -0.5));
        if (vIdx < 3u) { localPos = tri[vIdx]; }
    } else { // Star
        if (step > 0u) {
            let vertexInSlice = slice + (step - 1u);
            let isOuter = (vertexInSlice % 2u == 0u);
            let radius = select(0.382, 1.0, isOuter);
            let angle = f32(vertexInSlice) * (6.28318 / 10.0);
            localPos = vec2f(cos(angle), sin(angle)) * radius;
        }
    }

    // --- APPLY ROTATION MATRIX ---
    let c = cos(p.rotation);
    let s = sin(p.rotation);
    let rotatedPos = vec2f(
        localPos.x * c - localPos.y * s,
        localPos.x * s + localPos.y * c
    );

    let worldPos = (rotatedPos * p.size + p.pos - camera.pos) / camera.zoom;
    
    var out: VertexOutput;
    out.clip_pos = vec4f(worldPos, 0.0, 1.0);
    out.color = p.color;
    return out;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
    return in.color;
}
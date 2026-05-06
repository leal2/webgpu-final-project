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

    // --- 1. DAMPING & LIMITS ---
    // Apply "Air Resistance" (Damping) to stop infinite energy gain
    let linearDamping = 0.995; 
    let angularDamping = 0.98;
    
    p.vel *= linearDamping;
    p.angularVel *= angularDamping;

    // --- 2. MOTION & GRAVITY ---
    if (params.gravity > 0.0) {
        p.vel.y -= params.gravity * params.dt;
    } else {
        // CONSTANT MOTION: Keep a minimum speed, but clamp the maximum
        let speed = length(p.vel);
        if (speed > 0.0) {
            // Keep speed between 0.5 and 2.0
            let targetSpeed = clamp(speed, 0.5, 2.0);
            p.vel = (p.vel / speed) * targetSpeed;
        }
    }

    p.pos += p.vel * params.dt;
    p.rotation += p.angularVel * params.dt;

    // --- 3. COLLISIONS ---
    for (var j = 0u; j < u32(params.numParticles); j++) {
        if (i == j) { continue; }
        var other = particlesCompute[j];
        
        var rA = p.size;
        if (p.kind > 0.5) { rA *= 0.85; }
        var rB = other.size;
        if (other.kind > 0.5) { rB *= 0.85; }

        let collisionDist = rA + rB;
        let diff = p.pos - other.pos;
        let dist = length(diff);

        if (dist < collisionDist && dist > 0.0) {
            let normal = diff / dist;
            let overlap = collisionDist - dist;
            p.pos += normal * overlap * 0.5;

            let relativeVel = p.vel - other.vel;
            let velocityAlongNormal = dot(relativeVel, normal);

            if (velocityAlongNormal < 0.0) {
                let e = min(p.restitution, other.restitution);
                let impulse = -(1.0 + e) * velocityAlongNormal;
                
                let massSum = p.size + other.size;
                let impulseVec = (impulse * normal * other.size) / massSum;
                p.vel += impulseVec;

                // --- SOFTENED ANGULAR IMPULSE ---
                let tangent = vec2f(-normal.y, normal.x);
                // Reduced multiplier (0.1) to prevent "whiplash" spinning
                let torque = dot(relativeVel, tangent) * 0.1; 
                p.angularVel += (torque * impulse) / p.size;
            }
        }
    }

    // --- 4. BOUNDARIES ---
    let limit = 3.0;
    if (abs(p.pos.x) > limit) {
        p.pos.x = sign(p.pos.x) * limit;
        p.vel.x *= -p.restitution;
        p.angularVel *= 0.95; // Damping on impact
    }
    if (abs(p.pos.y) > limit) {
        p.pos.y = sign(p.pos.y) * limit;
        p.vel.y *= -p.restitution;
        p.angularVel *= 0.95;
    }

    // Clamp absolute maximums to prevent "NaN" or teleporting errors
    p.vel = clamp(p.vel, vec2f(-5.0), vec2f(5.0));
    p.angularVel = clamp(p.angularVel, -10.0, 10.0);

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
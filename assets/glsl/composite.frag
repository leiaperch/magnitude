#version 300 es
precision highp float;
uniform sampler2D uSceneT; uniform sampler2D uBloomT;
uniform vec2 uInvDst; uniform vec2 uRes2; uniform float uT2;
out vec4 O;
float hash2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
void main() {
  vec2 uv = gl_FragCoord.xy * uInvDst;
  vec3 col = texture(uSceneT, uv).rgb + texture(uBloomT, uv).rgb * 0.85;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, 1.14);
  col = col / (1.0 + col * 0.42);
  col = pow(max(col, vec3(0.0)), vec3(0.90));
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes2) / uRes2.y;
  col *= 1.0 - 0.4 * dot(q, q);
  col += (hash2(gl_FragCoord.xy + fract(uT2)) - 0.5) * 0.02;
  O = vec4(col, 1.0);
}

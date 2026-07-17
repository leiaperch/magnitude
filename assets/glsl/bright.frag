#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uInvDst; uniform vec2 uSrcTexel;
out vec4 O;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvDst;
  vec3 c = texture(uTex, uv + uSrcTexel * vec2( 0.5,  0.5)).rgb
         + texture(uTex, uv + uSrcTexel * vec2(-0.5,  0.5)).rgb
         + texture(uTex, uv + uSrcTexel * vec2( 0.5, -0.5)).rgb
         + texture(uTex, uv + uSrcTexel * vec2(-0.5, -0.5)).rgb;
  c *= 0.25;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  O = vec4(c * smoothstep(0.55, 1.0, lum), 1.0);
}

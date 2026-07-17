#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uInvDst; uniform vec2 uDir;
out vec4 O;
void main() {
  vec2 uv = gl_FragCoord.xy * uInvDst;
  vec3 a = texture(uTex, uv).rgb * 0.227027;
  a += (texture(uTex, uv + uDir * 1.3846).rgb + texture(uTex, uv - uDir * 1.3846).rgb) * 0.3162162;
  a += (texture(uTex, uv + uDir * 3.2308).rgb + texture(uTex, uv - uDir * 3.2308).rgb) * 0.0702703;
  O = vec4(a, 1.0);
}

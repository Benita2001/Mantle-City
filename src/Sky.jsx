export default function Sky() {
  // Daytime haze — matches scene.background, softens distant buildings
  return <fogExp2 attach="fog" args={['#D0E4F0', 0.010]} />
}

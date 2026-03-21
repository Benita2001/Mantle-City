export default function Sky() {
  // Night fog — matches scene.background, softens distant buildings
  return <fogExp2 attach="fog" args={['#050D20', 0.008]} />
}

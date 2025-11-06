import CollaborativeCanvas from '@/components/CollaborativeCanvas';

export default function CanvasPage({ params }) {
  return <CollaborativeCanvas userId={params.userId} />;
}

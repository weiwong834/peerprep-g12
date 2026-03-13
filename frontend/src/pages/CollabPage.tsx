import { useParams } from "react-router-dom";

export default function CollaborationPage() {
  const { sessionId } = useParams();

  return <div>Collaboration Page - Session: {sessionId}</div>;
}

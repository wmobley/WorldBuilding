import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthGate";
import { acceptCampaignInvite } from "../vault/queries";

export default function InvitePage() {
  const { inviteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"pending" | "accepted" | "error" | "mismatch">(
    "pending"
  );

  useEffect(() => {
    const handleInvite = async () => {
      if (!inviteId || !user?.id || !user.email) return;
      const invite = await acceptCampaignInvite(inviteId, user.id, user.email);
      if (!invite) {
        setStatus("mismatch");
        return;
      }
      setStatus("accepted");
      navigate(`/campaign/${invite.campaignId}/player`, { replace: true });
    };
    handleInvite().catch(() => setStatus("error"));
  }, [inviteId, navigate, user?.email, user?.id]);

  return (
    <div className="min-h-screen bg-parchment/80 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-page-edge bg-parchment/90 shadow-page p-6 space-y-4">
        <div className="text-2xl font-display text-ink">Joining campaign</div>
        {status === "pending" && (
          <p className="text-sm font-ui text-ink-soft">Accepting your invite…</p>
        )}
        {status === "accepted" && (
          <p className="text-sm font-ui text-ink-soft">Invite accepted. Redirecting…</p>
        )}
        {status === "mismatch" && (
          <p className="text-sm font-ui text-ember">
            This invite does not match your email address.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm font-ui text-ember">
            Could not accept the invite. Please try again or ask the DM to resend it.
          </p>
        )}
      </div>
    </div>
  );
}

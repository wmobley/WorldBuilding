import { useEffect, useMemo, useState } from "react";
import useSupabaseQuery from "../../lib/useSupabaseQuery";
import {
  createCampaign,
  getSetting,
  listCampaigns,
  setSetting,
  updateAllFolderIndexes
} from "../../vault/queries";
import {
  migrateImplicitWorld,
  migrateIndexDocsToSubfolders,
  removeDocsMatchingSubfolders,
  seedCampaignIfNeeded
} from "../../vault/seed";
import type { Campaign } from "../../vault/types";

const activateCampaign = async (campaignId: string) => {
  await setSetting("activeCampaignId", campaignId);
  await seedCampaignIfNeeded(campaignId);
  await migrateImplicitWorld(campaignId);
  await updateAllFolderIndexes(campaignId);
  await migrateIndexDocsToSubfolders(campaignId);
  await removeDocsMatchingSubfolders(campaignId);
};

export default function useVaultCampaigns() {
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const campaigns = useSupabaseQuery(() => listCampaigns(), [], [], {
    tables: ["campaigns"]
  });

  const activeCampaign = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === activeCampaignId) ?? null,
    [campaigns, activeCampaignId]
  );

  useEffect(() => {
    const ensureCampaign = async () => {
      const storedCampaignId = await getSetting("activeCampaignId");
      if (storedCampaignId) {
        setActiveCampaignId(storedCampaignId);
        await activateCampaign(storedCampaignId);
        return;
      }

      const existing = await listCampaigns();
      if (existing.length > 0) {
        const first = existing[0];
        setActiveCampaignId(first.id);
        await activateCampaign(first.id);
        return;
      }

      const campaign = await createCampaign("Campaign One", "");
      setActiveCampaignId(campaign.id);
      await activateCampaign(campaign.id);
    };

    ensureCampaign().catch(() => undefined);
  }, []);

  const selectCampaign = async (campaignId: string) => {
    setActiveCampaignId(campaignId);
    await activateCampaign(campaignId);
  };

  const createCampaignAndActivate = async (name: string, synopsis: string) => {
    const campaign = await createCampaign(name, synopsis);
    setActiveCampaignId(campaign.id);
    await activateCampaign(campaign.id);
    return campaign;
  };

  return {
    campaigns,
    activeCampaignId,
    activeCampaign,
    setActiveCampaignId,
    selectCampaign,
    createCampaignAndActivate
  };
}

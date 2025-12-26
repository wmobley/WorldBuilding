import faction from "../../templates/Faction.md?raw";
import religion from "../../templates/Religion.md?raw";
import region from "../../templates/Region.md?raw";
import place from "../../templates/Place.md?raw";
import country from "../../templates/Country.md?raw";
import town from "../../templates/Town.md?raw";
import village from "../../templates/Village.md?raw";
import fort from "../../templates/Fort.md?raw";
import magic from "../../templates/Magic_and_Cosmology.md?raw";
import history from "../../templates/History_and_Ages.md?raw";
import figures from "../../templates/Notable_Figures.md?raw";
import myths from "../../templates/Myths_and_Legends.md?raw";
import welcome from "../../templates/Welcome.md?raw";
import campaignOverview from "../../templates/Campaign_Overview.md?raw";
import adventurePrimer from "../../templates/Adventure_Primer.md?raw";
import runningAdventure from "../../templates/Running_the_Adventure.md?raw";
import adventureChapter from "../../templates/Adventure_Chapter.md?raw";
import scene from "../../templates/Scene.md?raw";
import storyTracker from "../../templates/Story_Tracker.md?raw";
import mapHandout from "../../templates/Map_or_Handout.md?raw";
import epilogue from "../../templates/Epilogue.md?raw";
import premadeCharacters from "../../templates/Premade_Characters.md?raw";
import appendixIndex from "../../templates/Appendix_Index.md?raw";
import plotArc from "../../templates/Plot_Arc.md?raw";
import npc from "../../templates/NPC.md?raw";

export type TemplateOption = {
  id: string;
  label: string;
  content: string;
};

export const templates: TemplateOption[] = [
  { id: "welcome", label: "Welcome", content: welcome },
  { id: "faction", label: "Faction", content: faction },
  { id: "religion", label: "Religion", content: religion },
  { id: "place", label: "Place", content: place },
  { id: "region", label: "Region", content: region },
  { id: "country", label: "Country", content: country },
  { id: "town", label: "Town", content: town },
  { id: "village", label: "Village", content: village },
  { id: "fort", label: "Fort", content: fort },
  { id: "magic-cosmology", label: "Magic & Cosmology", content: magic },
  { id: "history-ages", label: "History & Ages", content: history },
  { id: "notable-figures", label: "Notable Figure", content: figures },
  { id: "myths-legends", label: "Myths & Legends", content: myths },
  { id: "campaign-overview", label: "Campaign Overview", content: campaignOverview },
  { id: "adventure-primer", label: "Adventure Primer", content: adventurePrimer },
  { id: "running-adventure", label: "Running the Adventure", content: runningAdventure },
  { id: "adventure-chapter", label: "Adventure Chapter", content: adventureChapter },
  { id: "scene", label: "Scene", content: scene },
  { id: "story-tracker", label: "Story Tracker", content: storyTracker },
  { id: "map-handout", label: "Map or Handout", content: mapHandout },
  { id: "epilogue", label: "Epilogue", content: epilogue },
  { id: "premade-characters", label: "Premade Characters", content: premadeCharacters },
  { id: "npc", label: "NPC", content: npc },
  { id: "appendix-index", label: "Appendix Index", content: appendixIndex },
  { id: "plot-arc", label: "Plot Arc", content: plotArc }
];

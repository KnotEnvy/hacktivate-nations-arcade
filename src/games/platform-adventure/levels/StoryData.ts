import type { GuardType } from '../entities/Guard';

export type StoryTrigger =
    | { type: 'level_start' }
    | { type: 'position'; x: number; y: number; radius?: number }
    | { type: 'boss_alert'; bossType: GuardType }
    | { type: 'boss_defeat'; bossType: GuardType }
    | { type: 'boss_phase'; bossType: GuardType; phase: number };

export interface StoryEvent {
    id: string;
    title?: string;
    text: string;
    trigger: StoryTrigger;
}

const LEVEL_1_OPENING =
    '"The air smells of centuries. The crystals remember everyone who came before - their hopes, their failures. They wait to see what you will become."';

const LEVEL_2_OPENING =
    '"The crystals speak here. Some say they echo the thoughts of the dead. Others say they echo your own fears back at you. Does it matter which is true?"';

const LEVEL_3_OPENING =
    '"Here walk the echoes of every seeker who came before. They are trapped between memory and dust. They will not let you pass peacefully - they cannot."';

const LEVEL_4_OPENING =
    '"The path forward is never straight. The Ancients believed that wisdom was proven not by speed, but by the choices made when no one is watching."';

const LEVEL_5_OPENING =
    '"At the center of all things, light and dark are the same. The Owl waits on its ancient perch. So does the Shadow. Only one of you will leave this place."';

// Captain dialogue (Level 3)
const CAPTAIN_ALERT =
    '"Turn back. The Owl does not forgive those who disturb its slumber. I was once like you - full of hope. Now I guard this door for eternity."';

const CAPTAIN_DEFEAT =
    '"I was a seeker too... three hundred years ago. The Caverns took my body, but the Owl... the Owl took something else. ' +
    'Go. Find the truth I could not. But beware the Shadow - it knows your name already."';

// Shadow dialogue (Level 5)
const SHADOW_ALERT =
    '"I am the truth you hide from yourself. Every doubt. Every fear. Every moment you almost gave up. I am what waits at the end of all seekers."';

const SHADOW_PHASE_2 =
    '"You came here seeking redemption? There is none. The Owl shows only what IS - and what is... is darkness."';

const SHADOW_PHASE_3 =
    '"Give UP. Fall here, become another Guardian of these halls. It is easier. It is PEACEFUL. Why do you fight what you already know?"';

const SHADOW_DEFEAT =
    '"You have faced yourself... and chosen to continue. The Owl awaits. ' +
    'But know this - I am not destroyed. I am only... waiting. We will meet again, seeker. We always do."';

export const STORY_BY_LEVEL: Record<number, StoryEvent[]> = {
    0: [
        {
            id: 'l1-opening',
            title: 'The Forgotten Threshold',
            text: LEVEL_1_OPENING,
            trigger: { type: 'level_start' },
        },
        {
            id: 'l1-turn-back',
            title: 'Faded Inscription',
            text: '"TURN BACK"',
            trigger: { type: 'position', x: 6, y: 12, radius: 2 },
        },
        {
            id: 'l1-journal',
            title: 'Crumbling Journal',
            text:
                '"Day 3: The guards here are not alive, yet they walk. They wear the faces of men but move like memories. ' +
                'I think the Caverns create them from those who failed before. Gods help me - I think I see my brother among them."',
            trigger: { type: 'position', x: 22, y: 9, radius: 2 },
        },
        {
            id: 'l1-brave-door',
            title: 'Sealed Door',
            text: '"Only the brave may pass."',
            trigger: { type: 'position', x: 46, y: 12, radius: 2 },
        },
    ],
    1: [
        {
            id: 'l2-opening',
            title: 'Hall of Whispers',
            text: LEVEL_2_OPENING,
            trigger: { type: 'level_start' },
        },
    ],
    2: [
        {
            id: 'l3-opening',
            title: 'Gauntlet of the Fallen',
            text: LEVEL_3_OPENING,
            trigger: { type: 'level_start' },
        },
        {
            id: 'l3-captain-alert',
            title: 'The Captain',
            text: CAPTAIN_ALERT,
            trigger: { type: 'boss_alert', bossType: 'captain' },
        },
        {
            id: 'l3-captain-defeat',
            title: 'The Captain Falls',
            text: CAPTAIN_DEFEAT,
            trigger: { type: 'boss_defeat', bossType: 'captain' },
        },
    ],
    3: [
        {
            id: 'l4-opening',
            title: 'Labyrinth of Choices',
            text: LEVEL_4_OPENING,
            trigger: { type: 'level_start' },
        },
    ],
    4: [
        {
            id: 'l5-opening',
            title: 'Heart of Crystal',
            text: LEVEL_5_OPENING,
            trigger: { type: 'level_start' },
        },
        {
            id: 'l5-shadow-alert',
            title: 'The Shadow',
            text: SHADOW_ALERT,
            trigger: { type: 'boss_alert', bossType: 'shadow' },
        },
        {
            id: 'l5-shadow-phase2',
            title: 'The Shadow Awakens',
            text: SHADOW_PHASE_2,
            trigger: { type: 'boss_phase', bossType: 'shadow', phase: 2 },
        },
        {
            id: 'l5-shadow-phase3',
            title: 'Desperation',
            text: SHADOW_PHASE_3,
            trigger: { type: 'boss_phase', bossType: 'shadow', phase: 3 },
        },
        {
            id: 'l5-shadow-defeat',
            title: 'The Shadow Fades',
            text: SHADOW_DEFEAT,
            trigger: { type: 'boss_defeat', bossType: 'shadow' },
        },
    ],
};

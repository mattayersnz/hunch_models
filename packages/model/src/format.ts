// format.ts
//
// A hunch model as data: the one thing that leaves the author's notes. Everything a
// page draws, and everything a response points at, is in here.
//
// The shape is deliberately small. A model is some scenes; a scene is a place, the
// people in it, and the things around them; a person is what they do and what they
// think. That is the whole vocabulary, and it is what keeps every model readable by
// someone who has never seen one before.

import type { PieceLook } from "@hunch/kit";

// MARK: - The document

/** Why the author wants a response to one line in particular. */
export type Mark = "unsure" | "hunch" | "focus";

export const MARKS: readonly Mark[] = ["unsure", "hunch", "focus"];

/** Something a person does, or something they think. */
export interface ModelLine {
    id: string;
    text: string;
    marks: Mark[];
}

export interface Person {
    id: string;
    name: string;
    /** "27, renting with two friends". Not part of the id, so it can be refined. */
    about?: string;
    does: ModelLine[];
    thinks: ModelLine[];
}

export interface Scene {
    id: string;
    name: string;
    emoji?: string;
    people: Person[];
    /** Kit names: "phone", "couch". An unknown name still draws, as a labelled block. */
    pieces: string[];
    /** Optional generic appearances, keyed by the semantic names in `pieces`. */
    pieceLooks?: Partial<Record<string, PieceLook>>;
}

export interface HunchModel {
    version: 1;
    title: string;
    /** The one sentence the scenes are testing. */
    premise?: string;
    scenes: Scene[];
}

/** What a response can point at: the whole model, a scene, a person or one line. */
export type PieceKind = "model" | "scene" | "person" | "does" | "thinks";

// MARK: - Limits
//
// A model is something a stranger reads in a minute. These are generous for that and
// small enough that no page is ever a wall.

export const LIMITS = {
    title: 120,
    premise: 280,
    sceneName: 80,
    personName: 60,
    about: 120,
    line: 280,
    scenes: 12,
    peoplePerScene: 4,
    linesPerKind: 12,
    pieces: 12,
    pieceName: 32,
} as const;

// MARK: - Drafts
//
// What an author writes: the same shape with no ids. Ids are a function of content,
// so nobody ever has to invent one, and a page never trusts one it was handed.

export type LineDraft = string | { text: string; marks?: Mark[] };

export interface PersonDraft {
    name: string;
    about?: string;
    does?: LineDraft[];
    thinks?: LineDraft[];
}

export interface SceneDraft {
    name: string;
    emoji?: string;
    people?: PersonDraft[];
    pieces?: string[];
    pieceLooks?: Partial<Record<string, PieceLook>>;
}

export interface ModelDraft {
    version?: 1;
    title: string;
    premise?: string;
    scenes: SceneDraft[];
}

import { expect, test } from "bun:test";
import { captureEditorContext, withEditorOperation } from "./editor-operation";

test("overlapping operations reject; completion releases the lock", async () => {
	const editor = {};
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	const pending = withEditorOperation(editor, async () => {
		await blocked;
		return "first";
	});
	let secondExecuted = false;
	await expect(
		withEditorOperation(editor, async () => {
			secondExecuted = true;
		}),
	).rejects.toThrow("already running");
	expect(secondExecuted).toBe(false);
	expect(await withEditorOperation({}, async () => "other editor")).toBe(
		"other editor",
	);
	release();
	expect(await pending).toBe("first");
	expect(await withEditorOperation(editor, async () => "next")).toBe("next");
});

test("failed operations release the lock", async () => {
	const editor = {};
	await expect(
		withEditorOperation(editor, async () => {
			throw new Error("failed");
		}),
	).rejects.toThrow("failed");
	expect(await withEditorOperation(editor, async () => 42)).toBe(42);
});

test("context guard rejects changed project, scene, timeline and closed project", () => {
	const originalProject = { metadata: { id: "project-1" } };
	const originalScene = { id: "scene-1", tracks: {} };
	let project: typeof originalProject | null = originalProject;
	let scene: typeof originalScene | null = originalScene;
	const editor = {
		project: {
			getActive: () => originalProject,
			getActiveOrNull: () => project,
		},
		scenes: {
			getActiveScene: () => originalScene,
			getActiveSceneOrNull: () => scene,
		},
	};
	const context = captureEditorContext(editor);
	expect(context.projectId).toBe("project-1");
	expect(() => context.assertCurrent()).not.toThrow();
	project = { metadata: { id: "project-2" } };
	expect(() => context.assertCurrent()).toThrow("changed");
	project = originalProject;
	scene = { ...originalScene, id: "scene-2" };
	expect(() => context.assertCurrent()).toThrow("changed");
	scene = { ...originalScene, tracks: {} };
	expect(() => context.assertCurrent()).toThrow("changed");
	scene = originalScene;
	project = null;
	expect(() => context.assertCurrent()).toThrow("changed");
	project = originalProject;
	scene = null;
	expect(() => context.assertCurrent()).toThrow("changed");
});

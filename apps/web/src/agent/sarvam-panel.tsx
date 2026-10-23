"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogBody,
} from "@/components/ui/dialog";
import { useEditor } from "@/editor/use-editor";
import { callSarvam, executeEditorTool } from "./browser-actions";
import { LanguageExports } from "./language-exports";
import { runSarvamAssistant } from "./sarvam-assistant";
import { MotionTitleControls } from "./motion-title-controls";
import { createAgentSessionGuard } from "./session-guard";
import {
	sarvamLanguages as languages,
	bulbulLanguage,
	bulbulSpeaker,
} from "@/services/sarvam/languages";
export function SarvamPanel() {
	const editor = useEditor();
	const tracks = useEditor((e) => e.scenes.getActiveSceneOrNull()?.tracks);
	const [language, setLanguage] = useState("hi-IN"),
		[source, setSource] = useState("en-IN"),
		[trackId, setTrackId] = useState(""),
		[speaker, setSpeaker] = useState("shubh");
	const canGenerateVoice = bulbulLanguage.safeParse(language).success;
	const [busy, setBusy] = useState(false),
		[status, setStatus] = useState(""),
		[prompt, setPrompt] = useState("");
	const [session, setSession] = useState(""),
		[connecting, setConnecting] = useState(false);
	const sessionRef = useRef("");
	const sessionGuardRef = useRef<ReturnType<
		typeof createAgentSessionGuard
	> | null>(null);
	const textTracks = tracks?.overlay.filter((t) => t.type === "text") || [];
	async function run(name: string, args: unknown) {
		setBusy(true);
		setStatus("Working...");
		try {
			const result = await executeEditorTool(editor, name, args);
			setStatus(
				name === "export_languages"
					? "Language exports downloaded."
					: name === "export_subtitles"
						? "Subtitles downloaded."
						: name === "dub"
							? "Voice track created."
							: name === "add_motion_title"
								? "Motion title created."
								: "Caption track created.",
			);
			if (
				name !== "dub" &&
				name !== "add_motion_title" &&
				result &&
				typeof result === "object" &&
				"trackId" in result &&
				typeof result.trackId === "string"
			)
				setTrackId(result.trackId);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Action failed");
		} finally {
			setBusy(false);
		}
	}
	async function bridge(
		action: string,
		body: Record<string, unknown> = {},
		id = sessionRef.current,
	) {
		const response = await fetch("/api/editor-agent", {
			method: "POST",
			headers: { "Content-Type": "application/json", "x-editor-session": id },
			body: JSON.stringify({ action, ...body }),
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error);
		return data;
	}
	useEffect(() => {
		if (!session) return;
		const guard = sessionGuardRef.current;
		if (!guard) return;
		let cancelled = false,
			executing = false;
		const poll = async () => {
			if (cancelled) return;
			const heartbeatOnly = executing;
			if (!heartbeatOnly) executing = true;
			try {
				guard.assertCurrent();
				const data = await bridge(
					heartbeatOnly ? "heartbeat" : "poll",
					{},
					session,
				);
				if (cancelled) return;
				guard.assertCurrent();
				if (heartbeatOnly) return;
				for (const command of data.commands) {
					if (cancelled) return;
					guard.assertCurrent();
					let result: unknown, error: string | undefined;
					try {
						result = await executeEditorTool(
							editor,
							command.name,
							command.args,
						);
					} catch (e) {
						error = e instanceof Error ? e.message : "Action failed";
					}
					await bridge("result", { id: command.id, result, error }, session);
				}
			} catch (error) {
				if (!cancelled) {
					guard.cancel();
					setStatus(
						error instanceof Error ? error.message : "Connection failed",
					);
					setSession("");
					sessionRef.current = "";
				}
			} finally {
				if (!heartbeatOnly) executing = false;
			}
		};
		const timer = setInterval(() => void poll(), 1000);
		void poll();
		return () => {
			cancelled = true;
			guard.cancel();
			clearInterval(timer);
			void bridge("disconnect", {}, session).catch(() => {});
		};
	}, [session, editor]);
	async function connect() {
		setConnecting(true);
		try {
			if (session) {
				sessionGuardRef.current?.cancel();
				await bridge("disconnect");
				sessionRef.current = "";
				setSession("");
			} else {
				const guard = createAgentSessionGuard(editor);
				const data = await bridge("connect");
				try {
					guard.assertCurrent();
				} catch (error) {
					await bridge("disconnect", {}, data.sessionId).catch(() => {});
					throw error;
				}
				sessionGuardRef.current = guard;
				sessionRef.current = data.sessionId;
				setSession(data.sessionId);
			}
		} catch (e) {
			setStatus(e instanceof Error ? e.message : "Connection failed");
		} finally {
			setConnecting(false);
		}
	}
	async function chat() {
		if (!prompt.trim()) return;
		setBusy(true);
		setStatus("Thinking...");
		try {
			setStatus(
				await runSarvamAssistant({
					prompt,
					request: callSarvam,
					execute: (name, args) => executeEditorTool(editor, name, args),
				}),
			);
		} catch (e) {
			setStatus(e instanceof Error ? e.message : "Assistant failed");
		} finally {
			setBusy(false);
		}
	}
	const selectClass = "h-9 rounded border bg-background px-2 text-sm w-full";
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Sparkles className="size-4" />
					Sarvam
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Sarvam</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<div className="grid grid-cols-2 gap-3">
						<label className="text-sm">
							Source language
							<select
								aria-label="Source language"
								className={selectClass}
								value={source}
								onChange={(e) => setSource(e.target.value)}
							>
								{languages.map(([id, name]) => (
									<option key={id} value={id}>
										{name}
									</option>
								))}
							</select>
						</label>
						<label className="text-sm">
							Target language
							<select
								aria-label="Target language"
								className={selectClass}
								value={language}
								onChange={(e) => setLanguage(e.target.value)}
							>
								{languages.map(([id, name]) => (
									<option key={id} value={id}>
										{name}
									</option>
								))}
							</select>
						</label>
					</div>
					<Button
						disabled={busy}
						onClick={() => void run("transcribe", { language: source })}
					>
						Generate captions
					</Button>
					<label className="text-sm">
						Caption track
						<select
							aria-label="Caption track"
							className={selectClass}
							value={trackId}
							onChange={(e) => setTrackId(e.target.value)}
						>
							<option value="">Select track</option>
							{textTracks.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name} ({t.elements.length})
								</option>
							))}
						</select>
					</label>
					<label className="text-sm">
						Voice
						<select
							aria-label="Voice"
							className={selectClass}
							value={speaker}
							disabled={busy || !canGenerateVoice}
							onChange={(e) => setSpeaker(e.target.value)}
						>
							{bulbulSpeaker.options.map((name) => (
								<option key={name} value={name}>
									{name[0].toUpperCase() + name.slice(1)}
								</option>
							))}
						</select>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<Button
							variant="outline"
							disabled={busy || !trackId}
							onClick={() =>
								void run("translate_captions", {
									trackId,
									source,
									target: language,
								})
							}
						>
							Translate captions
						</Button>
						<Button
							variant="outline"
							disabled={busy || !trackId || !canGenerateVoice}
							title={
								canGenerateVoice
									? "Generate voice"
									: "Bulbul v3 does not support this language"
							}
							onClick={() => void run("dub", { trackId, language, speaker })}
						>
							Generate voice
						</Button>
					</div>
					<form
						aria-label="Sarvam assistant"
						onSubmit={(e) => {
							e.preventDefault();
							void chat();
						}}
						className="flex gap-2"
					>
						<input
							aria-label="Ask Sarvam"
							placeholder="Ask Sarvam..."
							className={selectClass}
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							disabled={busy}
						/>
						<Button
							size="icon"
							disabled={busy || !prompt.trim()}
							aria-label="Send to Sarvam"
						>
							{busy ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Send className="size-4" />
							)}
						</Button>
					</form>
					<Button
						variant="outline"
						disabled={connecting}
						onClick={() => void connect()}
					>
						{session ? (
							<Unlink className="size-4" />
						) : (
							<Link2 className="size-4" />
						)}
						{session ? "Disconnect agent" : "Connect agent"}
					</Button>
					<MotionTitleControls
						busy={busy}
						onAdd={(args) => void run("add_motion_title", args)}
					/>
					<LanguageExports
						tracks={tracks}
						sourceCaptionTrackId={trackId}
						busy={busy}
						onExport={(args) => void run("export_languages", args)}
					/>
					<Button
						variant="outline"
						disabled={busy || !trackId}
						onClick={() => void run("export_subtitles", { trackId, language })}
					>
						Download subtitles
					</Button>
					<p
						role="status"
						className="text-sm break-words whitespace-pre-wrap max-h-40 overflow-auto"
					>
						{status}
					</p>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

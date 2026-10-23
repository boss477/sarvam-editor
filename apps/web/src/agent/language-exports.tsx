"use client";
import { useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SceneTracks } from "@/timeline";
import { sarvamLanguages as languages } from "@/services/sarvam/languages";
type Variant = {
	id: string;
	language: string;
	captionTrackId: string;
	voiceTrackId: string;
};
export function LanguageExports({
	tracks,
	sourceCaptionTrackId,
	busy,
	onExport,
}: {
	tracks: SceneTracks | undefined;
	sourceCaptionTrackId: string;
	busy: boolean;
	onExport: (args: unknown) => void;
}) {
	const [variants, setVariants] = useState<Variant[]>([]);
	const [originalAudioTrackIds, setOriginalAudioTrackIds] = useState<string[]>(
		[],
	);
	const [format, setFormat] = useState("mp4");
	const captions = tracks?.overlay.filter((t) => t.type === "text") || [];
	const voices = tracks?.audio || [];
	const update = (id: string, patch: Partial<Variant>) =>
		setVariants((rows) =>
			rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
		);
	const select = "min-w-0 w-full h-9 rounded border bg-background px-2 text-sm";
	return (
		<fieldset disabled={busy} className="border-t pt-4 space-y-3 min-w-0">
			<div className="flex items-center justify-between">
				<legend className="text-sm font-medium">Language exports</legend>
				<Button
					variant="ghost"
					size="icon"
					type="button"
					aria-label="Add language export"
					title="Add language export"
					disabled={variants.length >= languages.length}
					onClick={() =>
						setVariants((rows) => [
							...rows,
							{
								id: crypto.randomUUID(),
								language: languages.find(
									([id]) => !rows.some((row) => row.language === id),
								)![0],
								captionTrackId: sourceCaptionTrackId,
								voiceTrackId: "",
							},
						])
					}
				>
					<Plus className="size-4" />
				</Button>
			</div>
			{variants.map((row, index) => (
				<div
					key={row.id}
					className="grid grid-cols-[1fr_1fr_2rem] gap-2 border-b pb-3"
				>
					<label className="text-xs col-span-2">
						Language
						<select
							className={select}
							aria-label={"Export language " + (index + 1)}
							value={row.language}
							onChange={(e) => update(row.id, { language: e.target.value })}
						>
							{languages.map(([id, name]) => (
								<option
									key={id}
									value={id}
									disabled={variants.some(
										(other) => other.id !== row.id && other.language === id,
									)}
								>
									{name}
								</option>
							))}
						</select>
					</label>
					<Button
						size="icon"
						variant="ghost"
						type="button"
						aria-label={"Remove export " + (index + 1)}
						title="Remove export"
						onClick={() =>
							setVariants((rows) => rows.filter((other) => other.id !== row.id))
						}
					>
						<Trash2 className="size-4" />
					</Button>
					<label className="text-xs">
						Captions
						<select
							className={select}
							aria-label={"Export captions " + (index + 1)}
							value={row.captionTrackId}
							onChange={(e) =>
								update(row.id, { captionTrackId: e.target.value })
							}
						>
							<option value="">Select track</option>
							{captions.map((track) => (
								<option key={track.id} value={track.id}>
									{track.name}:{" "}
									{String(track.elements[0]?.params.content || "").slice(0, 24)}
								</option>
							))}
						</select>
					</label>
					<label className="text-xs col-span-2">
						Voice
						<select
							className={select}
							aria-label={"Export voice " + (index + 1)}
							value={row.voiceTrackId}
							onChange={(e) => update(row.id, { voiceTrackId: e.target.value })}
						>
							<option value="">Original audio</option>
							{voices.map((track) => (
								<option key={track.id} value={track.id}>
									{track.name}: {track.elements[0]?.name}
								</option>
							))}
						</select>
					</label>
				</div>
			))}
			{voices.length > 0 && variants.some((row) => row.voiceTrackId) && (
				<div className="space-y-2">
					<p className="text-xs">Replace original speech tracks</p>
					{voices
						.filter(
							(track) => !variants.some((row) => row.voiceTrackId === track.id),
						)
						.map((track) => (
							<label key={track.id} className="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={originalAudioTrackIds.includes(track.id)}
									onChange={(e) =>
										setOriginalAudioTrackIds((ids) =>
											e.target.checked
												? [...ids, track.id]
												: ids.filter((id) => id !== track.id),
										)
									}
								/>
								{track.name}: {track.elements[0]?.name}
							</label>
						))}
				</div>
			)}
			<div className="flex gap-2">
				<select
					aria-label="Language export format"
					className={select}
					value={format}
					onChange={(e) => setFormat(e.target.value)}
				>
					<option value="mp4">MP4</option>
					<option value="webm">WebM</option>
				</select>
				<Button
					variant="outline"
					disabled={
						!variants.length || variants.some((row) => !row.captionTrackId)
					}
					onClick={() =>
						onExport({
							format,
							sourceCaptionTrackId: sourceCaptionTrackId || undefined,
							originalAudioTrackIds,
							variants: variants.map(
								({ language, captionTrackId, voiceTrackId }) => ({
									language,
									captionTrackId,
									voiceTrackId: voiceTrackId || undefined,
								}),
							),
						})
					}
				>
					<Download className="size-4" />
					Export ZIP
				</Button>
			</div>
		</fieldset>
	);
}

"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MotionTitleControls({
	busy,
	onAdd,
}: {
	busy: boolean;
	onAdd: (args: unknown) => void;
}) {
	const [text, setText] = useState("");
	const [preset, setPreset] = useState("lower-third");
	const [color, setColor] = useState("#ffffff");
	const [startTime, setStartTime] = useState(0),
		[duration, setDuration] = useState(4);
	const inputClass = "h-9 w-full rounded border bg-background px-2 text-sm";
	return (
		<fieldset disabled={busy} className="space-y-3 border-t pt-3">
			<legend className="text-sm font-medium">Motion title</legend>
			<input
				aria-label="Motion title text"
				className={inputClass}
				value={text}
				maxLength={300}
				onChange={(e) => setText(e.target.value)}
			/>
			<div className="flex items-center gap-2">
				<select
					aria-label="Motion title preset"
					className={inputClass}
					value={preset}
					onChange={(e) => setPreset(e.target.value)}
				>
					<option value="lower-third">Lower third</option>
					<option value="rise">Rising title</option>
					<option value="pop">Pop title</option>
				</select>
				<input
					type="color"
					aria-label="Motion title color"
					title="Title color"
					className="h-9 w-10 shrink-0"
					value={color}
					onChange={(e) => setColor(e.target.value)}
				/>
			</div>
			<div className="grid grid-cols-2 gap-3 text-sm">
				<label>
					Start (s)
					<input
						aria-label="Motion title start"
						type="number"
						min={0}
						step={0.1}
						className={inputClass}
						value={startTime}
						onChange={(e) => setStartTime(e.target.valueAsNumber)}
					/>
				</label>
				<label>
					Duration (s)
					<input
						aria-label="Motion title duration"
						type="number"
						min={1}
						max={60}
						step={0.1}
						className={inputClass}
						value={duration}
						onChange={(e) => setDuration(e.target.valueAsNumber)}
					/>
				</label>
			</div>
			<Button
				variant="outline"
				disabled={
					busy ||
					!text.trim() ||
					!Number.isFinite(startTime) ||
					startTime < 0 ||
					!Number.isFinite(duration) ||
					duration < 1 ||
					duration > 60
				}
				onClick={() => onAdd({ text, preset, color, startTime, duration })}
			>
				<Plus className="size-4" />
				Add title
			</Button>
		</fieldset>
	);
}

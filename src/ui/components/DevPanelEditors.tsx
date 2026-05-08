import { ChangeEvent, ReactNode } from 'react';
import {
  AchievementId,
  Character,
  CharacterAbility,
  CharacterPassive,
  DieSize,
  DieSource,
  EffectId,
  EffectSpec,
  EventChoice,
  EventChoiceKind,
  EventDef,
  EventReward,
  HeistTarget,
  PassiveId,
  PhaseCard,
  Requirement,
  RequirementOp,
  Rig,
  RigStartingDie,
  Screen,
} from '../../engine/types';
import { TutorialStep, TutorialMode } from '../../tutorial/steps';
import { ACHIEVEMENTS } from '../../content/achievements';

/*
 * Form-based editors for the dev panel. Each item-kind editor
 * (PhaseCardEditor / AbilityEditor / TargetEditor / EventEditor) renders
 * the full record as labeled fields, dropdowns, and number inputs;
 * complex sub-shapes (Requirement, EffectSpec, EventChoice) are factored
 * into their own small editors so they can be reused.
 *
 * The pattern throughout: each editor receives `value` + `onChange(next)`
 * and is otherwise pure. Optional fields use a checkbox to toggle
 * presence — toggling off removes the field from the working draft so
 * the dev-panel diff machinery treats the override as "unset relative
 * to base" rather than "set to empty".
 */

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

const DIE_SIZES: DieSize[] = [4, 6, 8, 10, 12, 20];

const REQUIREMENT_KINDS: Requirement['kind'][] = [
  'sum',
  'xOfAKind',
  'straight',
  'evens',
  'odds',
  'maxes',
];

const REQ_OPS: RequirementOp[] = ['lt', 'lte', 'eq', 'gte', 'gt'];

const EFFECT_IDS: EffectId[] = [
  'rerollHighest',
  'rerollLowest',
  'rerollAll',
  'rerollSelected',
  'setDieToMax',
  'setDieToValue',
  'setTwoDiceToOne',
  'removeOnes',
  'addDice',
  'removeHeat',
  'duplicateDie',
];

const TARGET_TIERS: Array<1 | 2 | 3> = [1, 2, 3];

const EVENT_CHOICE_KINDS: EventChoiceKind[] = [
  'payCreds',
  'payDie',
  'payAbility',
  'opposeRoll',
  'thresholdRoll',
  'upgradeAbility',
  'walkAway',
];

// Inline labels that read more naturally than the raw effect ids.
const EFFECT_LABEL: Record<EffectId, string> = {
  rerollHighest: 'reroll highest',
  rerollLowest: 'reroll lowest',
  rerollAll: 'reroll all',
  rerollSelected: 'reroll selected',
  setDieToMax: 'set a die to max',
  setDieToValue: 'set a die to value',
  setTwoDiceToOne: 'set two dice to 1',
  removeOnes: 'remove all 1s',
  addDice: 'add dice to pool',
  removeHeat: 'remove heat dice',
  duplicateDie: 'duplicate a die',
};

// ───────────────────────────────────────────────────────────────────────────
// Tiny shared primitives
// ───────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  inline?: boolean;
}

export function Field({ label, hint, children, inline }: FieldProps) {
  return (
    <div className={`dev-field${inline ? ' dev-field--inline' : ''}`}>
      <span className="dev-field-label">{label}</span>
      <div className="dev-field-control">{children}</div>
      {hint && <span className="dev-field-hint">{hint}</span>}
    </div>
  );
}

interface OptionalToggleProps {
  label: string;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  children?: ReactNode;
  hint?: string;
}

// Optional fields render with a checkbox header. Toggling on hands the
// caller a chance to seed a default value via onToggle(true); toggling
// off should drop the field from the working draft.
export function OptionalField({
  label,
  enabled,
  onToggle,
  children,
  hint,
}: OptionalToggleProps) {
  return (
    <div className={`dev-field dev-field--optional${enabled ? ' dev-field--enabled' : ''}`}>
      <label className="dev-field-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="dev-field-label">{label}</span>
      </label>
      {hint && <span className="dev-field-hint">{hint}</span>}
      {enabled && <div className="dev-field-control">{children}</div>}
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  placeholder,
}: NumberInputProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? 0 : Number(e.target.value);
    if (Number.isNaN(v)) return;
    onChange(v);
  };
  return (
    <input
      type="number"
      className={`dev-input dev-input--number ${className ?? ''}`}
      value={Number.isFinite(value) ? value : 0}
      onChange={handle}
      min={min}
      max={max}
      step={step ?? 1}
      placeholder={placeholder}
    />
  );
}

interface TextInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

function TextInput({ value, onChange, placeholder, className }: TextInputProps) {
  return (
    <input
      type="text"
      className={`dev-input ${className ?? ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

interface TextAreaProps extends TextInputProps {
  rows?: number;
}

function TextArea({ value, onChange, placeholder, rows }: TextAreaProps) {
  return (
    <textarea
      className="dev-input dev-input--textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows ?? 3}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Requirement editor
// ───────────────────────────────────────────────────────────────────────────

interface RequirementEditorProps {
  value: Requirement;
  onChange: (next: Requirement) => void;
}

function defaultRequirementForKind(kind: Requirement['kind']): Requirement {
  switch (kind) {
    case 'sum':
      return { kind: 'sum', op: 'gte', value: 10, minDice: 2 };
    case 'xOfAKind':
      return { kind: 'xOfAKind', count: 3 };
    case 'straight':
      return { kind: 'straight', length: 3 };
    case 'evens':
      return { kind: 'evens', count: 2 };
    case 'odds':
      return { kind: 'odds', count: 2 };
    case 'maxes':
      return { kind: 'maxes', count: 1 };
  }
}

export function RequirementEditor({ value, onChange }: RequirementEditorProps) {
  return (
    <div className="dev-sub dev-sub--requirement">
      <Field label="Kind" inline>
        <select
          className="dev-input dev-input--select"
          value={value.kind}
          onChange={(e) =>
            onChange(
              defaultRequirementForKind(e.target.value as Requirement['kind']),
            )
          }
        >
          {REQUIREMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>

      {value.kind === 'sum' && (
        <>
          <Field label="Op" inline>
            <select
              className="dev-input dev-input--select"
              value={value.op}
              onChange={(e) =>
                onChange({ ...value, op: e.target.value as RequirementOp })
              }
            >
              {REQ_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value" inline>
            <NumberInput
              value={value.value}
              onChange={(n) => onChange({ ...value, value: n })}
              min={0}
              max={120}
            />
          </Field>
          <OptionalField
            label="Min dice"
            enabled={value.minDice !== undefined}
            onToggle={(on) =>
              onChange(
                on
                  ? { ...value, minDice: 1 }
                  : (() => {
                      const { minDice: _omit, ...rest } = value;
                      void _omit;
                      return rest as Requirement;
                    })(),
              )
            }
            hint="Force at least N dice be used."
          >
            <NumberInput
              value={value.minDice ?? 1}
              onChange={(n) => onChange({ ...value, minDice: n })}
              min={1}
              max={10}
            />
          </OptionalField>
          <OptionalField
            label="Max dice"
            enabled={value.maxDice !== undefined}
            onToggle={(on) =>
              onChange(
                on
                  ? { ...value, maxDice: Math.max(1, value.minDice ?? 1) }
                  : (() => {
                      const { maxDice: _omit, ...rest } = value;
                      void _omit;
                      return rest as Requirement;
                    })(),
              )
            }
            hint="Cap how many dice may be spent."
          >
            <NumberInput
              value={value.maxDice ?? 1}
              onChange={(n) => onChange({ ...value, maxDice: n })}
              min={1}
              max={10}
            />
          </OptionalField>
          <OptionalField
            label="Exact dice"
            enabled={value.exactDice !== undefined}
            onToggle={(on) =>
              onChange(
                on
                  ? { ...value, exactDice: 2 }
                  : (() => {
                      const { exactDice: _omit, ...rest } = value;
                      void _omit;
                      return rest as Requirement;
                    })(),
              )
            }
            hint="Force exactly N dice to be used. Overrides min/max when set."
          >
            <NumberInput
              value={value.exactDice ?? 1}
              onChange={(n) => onChange({ ...value, exactDice: n })}
              min={1}
              max={10}
            />
          </OptionalField>
        </>
      )}

      {(value.kind === 'xOfAKind' ||
        value.kind === 'evens' ||
        value.kind === 'odds' ||
        value.kind === 'maxes') && (
        <Field label="Count" inline>
          <NumberInput
            value={value.count}
            onChange={(n) => onChange({ ...value, count: n })}
            min={1}
            max={10}
          />
        </Field>
      )}

      {value.kind === 'straight' && (
        <Field label="Length" inline>
          <NumberInput
            value={value.length}
            onChange={(n) => onChange({ ...value, length: n })}
            min={2}
            max={6}
          />
        </Field>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EffectSpec editor
// ───────────────────────────────────────────────────────────────────────────

interface EffectEditorProps {
  value: EffectSpec;
  onChange: (next: EffectSpec) => void;
}

function defaultEffectForId(id: EffectId): EffectSpec {
  switch (id) {
    case 'addDice':
      return { id, text: 'Add a d6 to the pool', params: { sizes: [6] } };
    case 'removeHeat':
      return { id, text: 'Remove 1 heat die', params: { count: 1 } };
    case 'setDieToValue':
      return {
        id,
        text: 'Set a die to a value',
        params: { value: 3 },
        requiresTarget: 'die',
      };
    case 'setDieToMax':
      return { id, text: 'Set a die to its max', requiresTarget: 'die' };
    case 'setTwoDiceToOne':
      return { id, text: 'Set 2 dice to 1', requiresTarget: 'dice' };
    case 'duplicateDie':
      return { id, text: 'Duplicate a die', requiresTarget: 'die' };
    case 'rerollSelected':
      return { id, text: 'Reroll selected dice', requiresTarget: 'dice' };
    default:
      return { id, text: EFFECT_LABEL[id] };
  }
}

export function EffectEditor({ value, onChange }: EffectEditorProps) {
  const params = (value.params ?? {}) as Record<string, unknown>;
  const setParam = (key: string, v: unknown) => {
    const nextParams = { ...params };
    if (v === undefined) delete nextParams[key];
    else nextParams[key] = v;
    const cleaned: EffectSpec = { ...value };
    if (Object.keys(nextParams).length === 0) {
      delete cleaned.params;
    } else {
      cleaned.params = nextParams;
    }
    onChange(cleaned);
  };

  return (
    <div className="dev-sub dev-sub--effect">
      <Field label="Effect" inline>
        <select
          className="dev-input dev-input--select"
          value={value.id}
          onChange={(e) =>
            onChange(defaultEffectForId(e.target.value as EffectId))
          }
        >
          {EFFECT_IDS.map((id) => (
            <option key={id} value={id}>
              {EFFECT_LABEL[id]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Display text">
        <TextInput
          value={value.text}
          onChange={(t) => onChange({ ...value, text: t })}
          placeholder="Player-facing description"
        />
      </Field>

      {value.id === 'removeHeat' && (
        <Field label="Heat dice removed" inline>
          <NumberInput
            value={(params.count as number) ?? 1}
            onChange={(n) => setParam('count', n)}
            min={1}
            max={20}
          />
        </Field>
      )}

      {value.id === 'setDieToValue' && (
        <Field label="Set value to" inline>
          <NumberInput
            value={(params.value as number) ?? 1}
            onChange={(n) => setParam('value', n)}
            min={1}
            max={20}
          />
        </Field>
      )}

      {value.id === 'addDice' && (
        <Field label="Dice to add">
          <DieSizeListEditor
            value={(params.sizes as DieSize[]) ?? []}
            onChange={(next) => setParam('sizes', next)}
          />
        </Field>
      )}

      <OptionalField
        label="Requires target"
        enabled={value.requiresTarget !== undefined}
        onToggle={(on) =>
          onChange(
            on
              ? { ...value, requiresTarget: 'die' }
              : (() => {
                  const { requiresTarget: _omit, ...rest } = value;
                  void _omit;
                  return rest as EffectSpec;
                })(),
          )
        }
        hint="Player must pre-select pool dice before activating."
      >
        <select
          className="dev-input dev-input--select"
          value={value.requiresTarget ?? 'die'}
          onChange={(e) =>
            onChange({
              ...value,
              requiresTarget: e.target.value as 'none' | 'die' | 'dice',
            })
          }
        >
          <option value="none">none</option>
          <option value="die">single die</option>
          <option value="dice">multiple dice</option>
        </select>
      </OptionalField>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// DieSize list editor (momentumDice, opposingDice)
// ───────────────────────────────────────────────────────────────────────────

interface DieSizeListEditorProps {
  value: DieSize[];
  onChange: (next: DieSize[]) => void;
}

export function DieSizeListEditor({ value, onChange }: DieSizeListEditorProps) {
  return (
    <div className="dev-die-list">
      {value.map((size, i) => (
        <span key={i} className="dev-die-chip">
          <select
            className="dev-input dev-input--select dev-input--small"
            value={size}
            onChange={(e) => {
              const next = [...value];
              next[i] = Number(e.target.value) as DieSize;
              onChange(next);
            }}
          >
            {DIE_SIZES.map((s) => (
              <option key={s} value={s}>
                d{s}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="dev-die-rm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label="Remove"
            title="Remove this die"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        className="dev-die-add"
        onClick={() => onChange([...value, 6])}
      >
        + add d6
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EventReward editor
// ───────────────────────────────────────────────────────────────────────────

interface EventRewardEditorProps {
  value: EventReward;
  onChange: (next: EventReward) => void;
  // Some choice kinds (walkAway) don't support a reward at all — caller
  // can hide the editor entirely. Otherwise just render with empty state.
}

function rewardEmpty(r: EventReward): boolean {
  return (
    !r.creds && !r.poolDie && !r.ghostDie && !r.removeHeat && !r.rareAbility
  );
}

export function EventRewardEditor({ value, onChange }: EventRewardEditorProps) {
  const update = (patch: Partial<EventReward>) => onChange({ ...value, ...patch });
  return (
    <div className="dev-sub dev-sub--reward">
      <OptionalField
        label="Creds"
        enabled={value.creds !== undefined}
        onToggle={(on) =>
          on ? update({ creds: 5 }) : update({ creds: undefined })
        }
      >
        <NumberInput
          value={value.creds ?? 0}
          onChange={(n) => update({ creds: n })}
          min={-50}
          max={50}
        />
      </OptionalField>

      <OptionalField
        label="Pool die"
        enabled={value.poolDie !== undefined}
        onToggle={(on) =>
          on ? update({ poolDie: 6 }) : update({ poolDie: undefined })
        }
      >
        <select
          className="dev-input dev-input--select"
          value={value.poolDie ?? 6}
          onChange={(e) => update({ poolDie: Number(e.target.value) as DieSize })}
        >
          {DIE_SIZES.map((s) => (
            <option key={s} value={s}>
              d{s}
            </option>
          ))}
        </select>
      </OptionalField>

      <OptionalField
        label="Ghost die"
        enabled={value.ghostDie !== undefined}
        onToggle={(on) =>
          on ? update({ ghostDie: 6 }) : update({ ghostDie: undefined })
        }
      >
        <select
          className="dev-input dev-input--select"
          value={value.ghostDie ?? 6}
          onChange={(e) =>
            update({ ghostDie: Number(e.target.value) as DieSize })
          }
        >
          {DIE_SIZES.map((s) => (
            <option key={s} value={s}>
              d{s}
            </option>
          ))}
        </select>
      </OptionalField>

      <OptionalField
        label="Remove heat"
        enabled={value.removeHeat !== undefined}
        onToggle={(on) =>
          on ? update({ removeHeat: 1 }) : update({ removeHeat: undefined })
        }
      >
        <NumberInput
          value={value.removeHeat ?? 1}
          onChange={(n) => update({ removeHeat: n })}
          min={0}
          max={20}
        />
      </OptionalField>

      <Field label="Grants rare ability" inline>
        <input
          type="checkbox"
          checked={!!value.rareAbility}
          onChange={(e) =>
            update({ rareAbility: e.target.checked ? true : undefined })
          }
        />
      </Field>

      {rewardEmpty(value) && (
        <div className="dev-field-hint">No reward configured.</div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EventChoice list editor
// ───────────────────────────────────────────────────────────────────────────

interface EventChoicesEditorProps {
  value: EventChoice[];
  onChange: (next: EventChoice[]) => void;
}

function defaultChoice(): EventChoice {
  return {
    id: `choice-${Date.now()}`,
    kind: 'walkAway',
    label: 'WALK AWAY',
  };
}

function reseedChoiceForKind(prev: EventChoice, kind: EventChoiceKind): EventChoice {
  // Strip kind-specific cost / reward fields when changing kind so the
  // editor doesn't inherit nonsensical leftovers.
  const base: EventChoice = {
    id: prev.id,
    kind,
    label: prev.label,
    costLabel: prev.costLabel,
    rewardLabel: prev.rewardLabel,
    hint: prev.hint,
    reward: prev.reward,
    penalty: prev.penalty,
  };
  switch (kind) {
    case 'payCreds':
      return { ...base, creds: 4 };
    case 'payDie':
      return { ...base, dieSize: 6 };
    case 'opposeRoll':
      return { ...base, opposingDice: [8, 8] };
    case 'thresholdRoll':
      return { ...base, threshold: 8 };
    default:
      return base;
  }
}

export function EventChoicesEditor({ value, onChange }: EventChoicesEditorProps) {
  const updateAt = (i: number, choice: EventChoice) => {
    const next = [...value];
    next[i] = choice;
    onChange(next);
  };
  const removeAt = (i: number) =>
    onChange(value.filter((_, j) => j !== i));

  return (
    <div className="dev-choices">
      {value.map((c, i) => (
        <div key={i} className="dev-choice">
          <div className="dev-choice-head">
            <span className="dev-choice-num">#{i + 1}</span>
            <button
              type="button"
              className="dev-choice-rm"
              onClick={() => removeAt(i)}
            >
              REMOVE
            </button>
          </div>

          <Field label="Choice id" inline>
            <TextInput
              value={c.id}
              onChange={(t) => updateAt(i, { ...c, id: t })}
              placeholder="stable-id"
            />
          </Field>
          <Field label="Kind" inline>
            <select
              className="dev-input dev-input--select"
              value={c.kind}
              onChange={(e) =>
                updateAt(i, reseedChoiceForKind(c, e.target.value as EventChoiceKind))
              }
            >
              {EVENT_CHOICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Button label" inline>
            <TextInput
              value={c.label}
              onChange={(t) => updateAt(i, { ...c, label: t })}
            />
          </Field>

          <OptionalField
            label="Cost label"
            enabled={c.costLabel !== undefined}
            onToggle={(on) =>
              updateAt(i, on ? { ...c, costLabel: '' } : { ...c, costLabel: undefined })
            }
          >
            <TextInput
              value={c.costLabel ?? ''}
              onChange={(t) => updateAt(i, { ...c, costLabel: t })}
              placeholder="¢ 5"
            />
          </OptionalField>
          <OptionalField
            label="Reward label"
            enabled={c.rewardLabel !== undefined}
            onToggle={(on) =>
              updateAt(i, on ? { ...c, rewardLabel: '' } : { ...c, rewardLabel: undefined })
            }
          >
            <TextInput
              value={c.rewardLabel ?? ''}
              onChange={(t) => updateAt(i, { ...c, rewardLabel: t })}
              placeholder="+d8"
            />
          </OptionalField>
          <OptionalField
            label="Hint"
            enabled={c.hint !== undefined}
            onToggle={(on) =>
              updateAt(i, on ? { ...c, hint: '' } : { ...c, hint: undefined })
            }
          >
            <TextArea
              value={c.hint ?? ''}
              onChange={(t) => updateAt(i, { ...c, hint: t })}
              rows={2}
            />
          </OptionalField>

          {c.kind === 'payCreds' && (
            <Field label="Creds cost" inline>
              <NumberInput
                value={c.creds ?? 0}
                onChange={(n) => updateAt(i, { ...c, creds: n })}
                min={0}
                max={50}
              />
            </Field>
          )}
          {c.kind === 'payDie' && (
            <Field label="Die size required" inline>
              <select
                className="dev-input dev-input--select"
                value={c.dieSize ?? 6}
                onChange={(e) =>
                  updateAt(i, { ...c, dieSize: Number(e.target.value) as DieSize })
                }
              >
                {DIE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    d{s}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {c.kind === 'opposeRoll' && (
            <Field label="Opposing dice">
              <DieSizeListEditor
                value={c.opposingDice ?? []}
                onChange={(next) => updateAt(i, { ...c, opposingDice: next })}
              />
            </Field>
          )}
          {c.kind === 'thresholdRoll' && (
            <Field label="Threshold value" inline>
              <NumberInput
                value={c.threshold ?? 0}
                onChange={(n) => updateAt(i, { ...c, threshold: n })}
                min={1}
                max={20}
              />
            </Field>
          )}

          {c.kind !== 'walkAway' && (
            <OptionalField
              label="Reward (success)"
              enabled={c.reward !== undefined}
              onToggle={(on) =>
                updateAt(i, on ? { ...c, reward: {} } : { ...c, reward: undefined })
              }
            >
              <EventRewardEditor
                value={c.reward ?? {}}
                onChange={(r) => updateAt(i, { ...c, reward: r })}
              />
            </OptionalField>
          )}
          {(c.kind === 'opposeRoll' || c.kind === 'thresholdRoll') && (
            <OptionalField
              label="Penalty (failure)"
              enabled={c.penalty !== undefined}
              onToggle={(on) =>
                updateAt(i, on ? { ...c, penalty: {} } : { ...c, penalty: undefined })
              }
            >
              <EventRewardEditor
                value={c.penalty ?? {}}
                onChange={(p) => updateAt(i, { ...c, penalty: p })}
              />
            </OptionalField>
          )}
        </div>
      ))}
      <button
        type="button"
        className="dev-choice-add"
        onClick={() => onChange([...value, defaultChoice()])}
      >
        + add choice
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Item editors
// ───────────────────────────────────────────────────────────────────────────

interface PhaseCardEditorProps {
  value: PhaseCard;
  onChange: (next: PhaseCard) => void;
}

export function PhaseCardEditor({ value, onChange }: PhaseCardEditorProps) {
  const patch = (p: Partial<PhaseCard>) => onChange({ ...value, ...p });
  // The name field is rendered by DevPanelScreen as a click-to-edit
  // <h2> in the detail header — it's the same draft.name behind the
  // scenes, so duplicating it here would just confuse the player.
  return (
    <div className="dev-form">
      <Field label="Type" inline>
        <select
          className="dev-input dev-input--select"
          value={value.type}
          onChange={(e) => patch({ type: e.target.value as PhaseCard['type'] })}
        >
          <option value="phase">phase</option>
          <option value="goal">goal</option>
        </select>
      </Field>
      <OptionalField
        label="Icon (emoji)"
        enabled={value.icon !== undefined}
        onToggle={(on) => patch({ icon: on ? '?' : undefined })}
      >
        <TextInput
          value={value.icon ?? ''}
          onChange={(t) => patch({ icon: t })}
          placeholder="🔓"
        />
      </OptionalField>
      <Field label="Requirement">
        <RequirementEditor
          value={value.requirement}
          onChange={(r) => patch({ requirement: r })}
        />
      </Field>
      <OptionalField
        label="Difficulty (placement bucket)"
        hint="Easy = near the player at start. Hard = around the heist target. When off, the engine guesses from the requirement shape."
        enabled={value.difficulty !== undefined}
        onToggle={(on) =>
          patch({ difficulty: on ? 2 : undefined })
        }
      >
        <select
          className="dev-input dev-input--select"
          value={value.difficulty ?? 2}
          onChange={(e) =>
            patch({ difficulty: Number(e.target.value) as 1 | 2 | 3 })
          }
        >
          <option value={1}>1 — easy (near start)</option>
          <option value={2}>2 — medium</option>
          <option value={3}>3 — hard (near target)</option>
        </select>
      </OptionalField>
      <Field label="Momentum dice (rewarded on fulfill)">
        <DieSizeListEditor
          value={value.momentumDice}
          onChange={(d) => patch({ momentumDice: d })}
        />
      </Field>
      <OptionalField
        label="On-play effect"
        enabled={value.onPlayEffect !== undefined}
        onToggle={(on) =>
          patch({
            onPlayEffect: on
              ? { id: 'rerollAll', text: 'Reroll all pool dice' }
              : undefined,
          })
        }
      >
        <EffectEditor
          value={value.onPlayEffect ?? { id: 'rerollAll', text: '' }}
          onChange={(e) => patch({ onPlayEffect: e })}
        />
      </OptionalField>
      <OptionalField
        label="Cache reward (¢)"
        enabled={value.cacheReward !== undefined}
        onToggle={(on) => patch({ cacheReward: on ? 3 : undefined })}
        hint="Marks the tile as a Cache; awards creds when fulfilled."
      >
        <NumberInput
          value={value.cacheReward ?? 0}
          onChange={(n) => patch({ cacheReward: n })}
          min={1}
          max={50}
        />
      </OptionalField>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
    </div>
  );
}

interface AbilityEditorProps {
  value: CharacterAbility;
  onChange: (next: CharacterAbility) => void;
}

export function AbilityEditor({ value, onChange }: AbilityEditorProps) {
  const patch = (p: Partial<CharacterAbility>) => onChange({ ...value, ...p });
  // Name is owned by the detail header (click-to-edit). See note in
  // PhaseCardEditor.
  return (
    <div className="dev-form">
      <Field label="Icon (emoji)" inline>
        <TextInput
          value={value.icon}
          onChange={(t) => patch({ icon: t })}
          placeholder="💻"
        />
      </Field>
      <Field label="Description">
        <TextInput
          value={value.text}
          onChange={(t) => patch({ text: t })}
          placeholder="Spend a charge to ..."
        />
      </Field>
      <Field label="Cost (¢ to acquire)" inline>
        <NumberInput
          value={value.cost}
          onChange={(n) => patch({ cost: n })}
          min={0}
          max={50}
        />
      </Field>
      <Field
        label="Max charges (1–10)"
        inline
        hint="Cap on stored charges. Defaults to 3."
      >
        <NumberInput
          value={value.maxCharges ?? 3}
          onChange={(n) => patch({ maxCharges: Math.min(10, Math.max(1, n)) })}
          min={1}
          max={10}
        />
      </Field>
      <Field label="Charge trigger">
        <RequirementEditor
          value={value.trigger}
          onChange={(r) => patch({ trigger: r })}
        />
      </Field>
      <Field label="Effect">
        <EffectEditor
          value={value.effect}
          onChange={(e) => patch({ effect: e })}
        />
      </Field>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
    </div>
  );
}

interface TargetEditorProps {
  value: HeistTarget;
  onChange: (next: HeistTarget) => void;
}

export function TargetEditor({ value, onChange }: TargetEditorProps) {
  const patch = (p: Partial<HeistTarget>) => onChange({ ...value, ...p });
  // Name is owned by the detail header (click-to-edit). See note in
  // PhaseCardEditor.
  return (
    <div className="dev-form">
      <Field label="Icon (emoji)" inline>
        <TextInput value={value.icon} onChange={(t) => patch({ icon: t })} />
      </Field>
      <Field label="Tier" inline>
        <select
          className="dev-input dev-input--select"
          value={value.tier}
          onChange={(e) =>
            patch({ tier: Number(e.target.value) as 1 | 2 | 3 })
          }
        >
          {TARGET_TIERS.map((t) => (
            <option key={t} value={t}>
              tier {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Creds reward (on success)" inline>
        <NumberInput
          value={value.credsReward}
          onChange={(n) => patch({ credsReward: n })}
          min={0}
          max={50}
        />
      </Field>
      <Field label="Requirement">
        <RequirementEditor
          value={value.requirement}
          onChange={(r) => patch({ requirement: r })}
        />
      </Field>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
    </div>
  );
}

interface EventEditorProps {
  value: EventDef;
  onChange: (next: EventDef) => void;
}

export function EventEditor({ value, onChange }: EventEditorProps) {
  const patch = (p: Partial<EventDef>) => onChange({ ...value, ...p });
  // Title is owned by the detail header (click-to-edit). See note in
  // PhaseCardEditor.
  return (
    <div className="dev-form">
      <Field label="Flavor (typewriter narrative)">
        <TextArea
          value={value.flavor}
          onChange={(t) => patch({ flavor: t })}
          rows={3}
        />
      </Field>
      <Field label="Choices">
        <EventChoicesEditor
          value={value.choices}
          onChange={(c) => patch({ choices: c })}
        />
      </Field>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tutorial step editor — id and shouldShow predicate are NOT editable.
// Mode flips between 'auto' (no dismiss button, gate-driven) and 'info'
// (player must click GOT IT or hit Esc). Anchor is a CSS selector for
// the spotlight; leaving it off renders a centered modal.
// ───────────────────────────────────────────────────────────────────────────

const TUTORIAL_SCREENS: Screen[] = [
  'title',
  'characterSelect',
  'rigSelect',
  'map',
  'heist',
  'draft',
  'gameOver',
  'dev',
];

const TUTORIAL_MODES: TutorialMode[] = ['auto', 'info'];

interface TutorialStepEditorProps {
  value: TutorialStep;
  onChange: (next: TutorialStep) => void;
}

export function TutorialStepEditor({ value, onChange }: TutorialStepEditorProps) {
  const patch = (p: Partial<TutorialStep>) => onChange({ ...value, ...p });
  return (
    <div className="dev-form">
      <Field label="Screen" hint="Which game screen this step belongs to.">
        <select
          className="dev-input dev-input--select"
          value={value.screen}
          onChange={(e) => patch({ screen: e.target.value as Screen })}
        >
          {TUTORIAL_SCREENS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Mode"
        hint="'auto' dismisses on its own when the gate flips false. 'info' requires GOT IT (or Esc)."
      >
        <select
          className="dev-input dev-input--select"
          value={value.mode}
          onChange={(e) => patch({ mode: e.target.value as TutorialMode })}
        >
          {TUTORIAL_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Text" hint="Body copy shown inside the tooltip.">
        <TextArea
          value={value.text}
          onChange={(t) => patch({ text: t })}
          rows={4}
        />
      </Field>
      <OptionalField
        label="Anchor selector"
        hint="CSS selector for the highlighted element. Leave off for a centered modal."
        enabled={value.anchor !== undefined}
        onToggle={(on) =>
          patch(
            on
              ? { anchor: value.anchor ?? '' }
              : (() => {
                  const { anchor: _omit, ...rest } = value;
                  void _omit;
                  return rest as TutorialStep;
                })(),
          )
        }
      >
        <input
          type="text"
          className="dev-input"
          value={value.anchor ?? ''}
          onChange={(e) => patch({ anchor: e.target.value })}
          placeholder=".some-class, #some-id"
        />
      </OptionalField>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Character editor — name comes from the header rename treatment; this
// editor exposes the rest plus a nested passive sub-editor.
// ───────────────────────────────────────────────────────────────────────────

const PASSIVE_IDS: PassiveId[] = [
  'bonusD6OnPhaseFulfill',
  'noHeatFulfillOnPhaseFulfill',
  'keepMomentumBetweenHeists',
  'ghostDiceOnPhaseFulfill',
];

interface PassiveEditorProps {
  value: CharacterPassive;
  onChange: (next: CharacterPassive) => void;
}

function PassiveEditor({ value, onChange }: PassiveEditorProps) {
  const patch = (p: Partial<CharacterPassive>) => onChange({ ...value, ...p });
  return (
    <div className="dev-sub">
      <Field
        label="Passive id (engine-driven behavior)"
        hint="The id maps onto a hard-wired engine branch — see PassiveId in engine/types.ts."
        inline
      >
        <select
          className="dev-input dev-input--select"
          value={value.id}
          onChange={(e) => patch({ id: e.target.value as PassiveId })}
        >
          {PASSIVE_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Name (display)" inline>
        <TextInput value={value.name} onChange={(t) => patch({ name: t })} />
      </Field>
      <Field label="Icon (emoji)" inline>
        <TextInput
          value={value.icon}
          onChange={(t) => patch({ icon: t })}
          placeholder="💣"
        />
      </Field>
      <Field label="Text (mechanics line)">
        <TextArea value={value.text} onChange={(t) => patch({ text: t })} rows={2} />
      </Field>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
    </div>
  );
}

interface CharacterEditorProps {
  value: Character;
  onChange: (next: Character) => void;
}

export function CharacterEditor({ value, onChange }: CharacterEditorProps) {
  const patch = (p: Partial<Character>) => onChange({ ...value, ...p });
  return (
    <div className="dev-form">
      <Field label="Icon (pawn emoji)" inline>
        <TextInput
          value={value.icon}
          onChange={(t) => patch({ icon: t })}
          placeholder="🧑‍💻"
        />
      </Field>
      <Field label="Starting die size" inline>
        <select
          className="dev-input dev-input--select"
          value={value.startingDie}
          onChange={(e) =>
            patch({ startingDie: Number(e.target.value) as DieSize })
          }
        >
          {DIE_SIZES.map((s) => (
            <option key={s} value={s}>
              d{s}
            </option>
          ))}
        </select>
      </Field>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
      <Field label="Passive">
        <PassiveEditor
          value={value.passive}
          onChange={(p) => patch({ passive: p })}
        />
      </Field>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Rig editor — starting dice list (size/source/count) + gold + optional
// unlock-achievement gate.
// ───────────────────────────────────────────────────────────────────────────

const DIE_SOURCES: DieSource[] = ['phase', 'character', 'heat', 'stash', 'ghost'];

interface RigStartingDiceEditorProps {
  value: RigStartingDie[];
  onChange: (next: RigStartingDie[]) => void;
}

function RigStartingDiceEditor({ value, onChange }: RigStartingDiceEditorProps) {
  const updateAt = (i: number, next: RigStartingDie) => {
    const out = [...value];
    out[i] = next;
    onChange(out);
  };
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));
  const add = () =>
    onChange([...value, { size: 6, source: 'stash', count: 1 }]);
  return (
    <div className="dev-rig-dice">
      {value.map((d, i) => (
        <div key={i} className="dev-rig-die-row">
          <select
            className="dev-input dev-input--select dev-input--small"
            value={d.size}
            onChange={(e) =>
              updateAt(i, { ...d, size: Number(e.target.value) as DieSize })
            }
          >
            {DIE_SIZES.map((s) => (
              <option key={s} value={s}>
                d{s}
              </option>
            ))}
          </select>
          <select
            className="dev-input dev-input--select dev-input--small"
            value={d.source}
            onChange={(e) =>
              updateAt(i, { ...d, source: e.target.value as DieSource })
            }
          >
            {DIE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <NumberInput
            value={d.count}
            onChange={(n) => updateAt(i, { ...d, count: n })}
            min={1}
            max={10}
          />
          <button
            type="button"
            className="dev-die-rm"
            onClick={() => removeAt(i)}
            aria-label="Remove"
            title="Remove this die spec"
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="dev-add-btn" onClick={add}>
        + ADD DIE SPEC
      </button>
    </div>
  );
}

interface RigEditorProps {
  value: Rig;
  onChange: (next: Rig) => void;
}

export function RigEditor({ value, onChange }: RigEditorProps) {
  const patch = (p: Partial<Rig>) => onChange({ ...value, ...p });
  return (
    <div className="dev-form">
      <OptionalField
        label="Icon (emoji)"
        enabled={value.icon !== undefined}
        onToggle={(on) => patch({ icon: on ? '🎒' : undefined })}
      >
        <TextInput
          value={value.icon ?? ''}
          onChange={(t) => patch({ icon: t })}
          placeholder="🎒"
        />
      </OptionalField>
      <OptionalField
        label="Flavor"
        enabled={value.flavor !== undefined}
        onToggle={(on) => patch({ flavor: on ? '' : undefined })}
      >
        <TextArea
          value={value.flavor ?? ''}
          onChange={(t) => patch({ flavor: t })}
          rows={2}
        />
      </OptionalField>
      <Field label="Starting dice (added to first heist's pool)">
        <RigStartingDiceEditor
          value={value.startingDice}
          onChange={(d) => patch({ startingDice: d })}
        />
      </Field>
      <Field label="Starting creds" inline>
        <NumberInput
          value={value.startingGold}
          onChange={(n) => patch({ startingGold: n })}
          min={0}
          max={99}
        />
      </Field>
      <OptionalField
        label="Unlock achievement (gates the rig)"
        hint="Omit to leave the rig always unlocked."
        enabled={value.unlockAchievementId !== undefined}
        onToggle={(on) =>
          patch({
            unlockAchievementId: on
              ? (ACHIEVEMENTS[0]?.id as AchievementId)
              : undefined,
          })
        }
      >
        <select
          className="dev-input dev-input--select"
          value={value.unlockAchievementId ?? ACHIEVEMENTS[0]?.id ?? ''}
          onChange={(e) =>
            patch({ unlockAchievementId: e.target.value as AchievementId })
          }
        >
          {ACHIEVEMENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.id})
            </option>
          ))}
        </select>
      </OptionalField>
    </div>
  );
}

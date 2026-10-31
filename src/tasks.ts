/**
 * The chart: six days, four shifts, one cleaning task in every box.
 *
 * The tasks are written TWICE: here, and as `TASKS` at the top of
 * `apps-script/Code.gs`. The ids and the task names must match exactly — the
 * Sheet stores check marks by id, and refuses an id it doesn't know. If one
 * changes, change both, then run `npm test`, which compares them.
 */

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type ShiftId = 'breakfast' | 'lunch' | 'afternoon' | 'dinner';

export type Day = {
  id: DayId;
  label: string;
  /** The colour of the day's header on the store's printed chart. */
  color: string;
};

export type Shift = { id: ShiftId; label: string };

export const DAYS: Day[] = [
  { id: 'mon', label: 'Monday', color: '#D7193A' },
  { id: 'tue', label: 'Tuesday', color: '#0E7C6B' },
  { id: 'wed', label: 'Wednesday', color: '#D9740F' },
  { id: 'thu', label: 'Thursday', color: '#5A2A5C' },
  { id: 'fri', label: 'Friday', color: '#E0403A' },
  { id: 'sat', label: 'Saturday', color: '#1D2B4A' },
];

export const SHIFTS: Shift[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'dinner', label: 'Dinner' },
];

/** Task id → what to clean. The id is the day and shift: "mon-breakfast". */
export const TASKS: Record<string, string> = {
  'mon-breakfast': 'Drinks dump sink',
  'mon-lunch': 'Desserts station',
  'mon-afternoon': 'Manager station',
  'mon-dinner': 'Mobile drinks station',

  'tue-breakfast': 'All FOH drains',
  'tue-lunch': 'Coffee/tea brewer area',
  'tue-afternoon': 'DT sauce wall',
  'tue-dinner': 'Tea, lemonade, soda tower in DT',

  'wed-breakfast': 'Condiment towers',
  'wed-lunch': 'Ice dream machine',
  'wed-afternoon': 'Dump sink in drinks',
  'wed-dinner': 'Bag holders, condiment towers',

  'thu-breakfast': 'Both outside doors in DT',
  'thu-lunch': 'FC drinks station',
  'thu-afternoon': 'Mop pit area',
  'thu-dinner': 'Scrub under all machines in DT',

  'fri-breakfast': 'FC register stand',
  'fri-lunch': 'FC, 3rd party, kids meal table',
  'fri-afternoon': 'Trash cans in FOH, brooms, and dustpans',
  'fri-dinner': 'FC sauce wall',

  'sat-breakfast': 'Lemonade lowboy',
  'sat-lunch': 'Mobile drinks lowboy',
  'sat-afternoon': 'Bagging lowboy',
  'sat-dinner': 'Air vents in DT cockpit',
};

export const TASK_IDS = Object.keys(TASKS);

export const taskId = (day: DayId, shift: ShiftId) => `${day}-${shift}`;

export type TaskInfo = { id: string; day: Day; shift: Shift; task: string };

export function taskInfo(id: string): TaskInfo {
  const [dayId, shiftId] = id.split('-');
  return {
    id,
    day: DAYS.find((d) => d.id === dayId)!,
    shift: SHIFTS.find((s) => s.id === shiftId)!,
    task: TASKS[id],
  };
}

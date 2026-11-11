/*
 * The red centre button (P16, routes §1): "Start the next job", with a badge of the jobs ready now.
 * It is not a route: it opens the first of the day's jobs. The rule is core/store/jobs.ts (Today's
 * job list, which TD01 draws as 5 ready at 10:41); this file only keeps it live over the shell's state.
 */
import { computed } from '@preact/signals';
import { badge, nextJobs, yardJobs, type Job } from '../../../core/store/jobs.ts';
import { books, me, now } from './store.ts';

export const jobs = computed<Job[]>(() => (books.value ? yardJobs(books.value, me.value, now.value) : []));
export const nextJob = computed<Job | null>(() => nextJobs(jobs.value).next);
/** The badge (TD01: 5). */
export const ready = computed<number>(() => badge(jobs.value));

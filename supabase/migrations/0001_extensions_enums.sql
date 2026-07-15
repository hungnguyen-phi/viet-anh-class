-- 0001 — Extensions + enums (PRD §9.2)
create extension if not exists pgcrypto;

create type user_role as enum ('admin', 'principal', 'teacher', 'student', 'parent', 'pending');
create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type wig_area as enum ('knowledge', 'skills', 'english', 'physical');
create type wig_scope as enum ('class', 'student');
create type wig_period as enum ('year', 'month', 'week');
create type score_category as enum ('knowledge', 'skills', 'english', 'physical');

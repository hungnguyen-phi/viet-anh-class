-- 0017 — Cờ "đã xem hướng dẫn intro".
-- Onboarding chỉ hiện LẦN ĐẦU; lưu theo hồ sơ (không phải localStorage) → xuyên
-- thiết bị, đổi mật khẩu / cấp lại quyền vẫn không hiện lại.
-- Cột này KHÔNG bị trigger trg_protect_profile_cols chặn (chỉ chặn role/campus_id),
-- và prof_self_update cho phép user tự cập nhật hồ sơ của mình.

alter table profiles add column intro_seen boolean not null default false;

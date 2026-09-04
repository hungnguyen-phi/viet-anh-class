import {NextResponse} from 'next/server';

// /api/* KHÔNG TỒN TẠI → JSON 404, không phải trang HTML 404 của app (audit 04/09/2026). Ai gọi
// API thì đang đọc JSON; một trang HTML trả về là thứ họ không phân tích được.
const khongThay = () => NextResponse.json({error: 'khong_tim_thay'}, {status: 404});

export const GET = khongThay;
export const POST = khongThay;
export const PUT = khongThay;
export const PATCH = khongThay;
export const DELETE = khongThay;

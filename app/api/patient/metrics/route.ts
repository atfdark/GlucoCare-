import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/dbDB';
import { requireAuth } from '@/lib/requireAuth';
import { extractRequestMeta, safeAuditLog } from '@/lib/audit';

function resolveFromDate(range: string) {
    if (range === 'all') {
        return null;
    }

    const now = new Date();
    const fromDate = new Date(now);

    if (range === '90d') {
        fromDate.setDate(now.getDate() - 90);
    } else if (range === '30d') {
        fromDate.setDate(now.getDate() - 30);
    } else {
        fromDate.setDate(now.getDate() - 7);
    }

    return fromDate;
}

export async function GET(request: NextRequest) {
    const authResult = requireAuth(request, ['patient']);
    if (!authResult.ok) {
        return authResult.response;
    }

    const range = String(request.nextUrl.searchParams.get('range') || '90d').trim();
    const fromDate = resolveFromDate(range);

    const metrics = await prisma.healthMetric.findMany({
        where: {
            patientId: authResult.auth.userId,
            ...(fromDate ? { createdAt: { gte: fromDate } } : {})
        },
        orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ metrics });
}

export async function POST(request: NextRequest) {
    const authResult = requireAuth(request, ['patient']);
    if (!authResult.ok) {
        return authResult.response;
    }

    const requestMeta = extractRequestMeta(request.headers);
    const body = await request.json();

    const weight = Number(body.weight);
    const systolic = Number(body.systolic);
    const diastolic = Number(body.diastolic);
    const hba1c = Number(body.hba1c);
    const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();

    if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
        return NextResponse.json({ error: 'Invalid weight value' }, { status: 400 });
    }

    if (!Number.isFinite(systolic) || systolic < 70 || systolic > 220) {
        return NextResponse.json({ error: 'Invalid systolic value' }, { status: 400 });
    }

    if (!Number.isFinite(diastolic) || diastolic < 40 || diastolic > 140) {
        return NextResponse.json({ error: 'Invalid diastolic value' }, { status: 400 });
    }

    if (!Number.isFinite(hba1c) || hba1c < 3 || hba1c > 20) {
        return NextResponse.json({ error: 'Invalid HbA1c value' }, { status: 400 });
    }

    if (Number.isNaN(createdAt.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const metric = await prisma.healthMetric.create({
        data: {
            patientId: authResult.auth.userId,
            weight,
            systolic: Math.round(systolic),
            diastolic: Math.round(diastolic),
            hba1c,
            createdAt,
        }
    });

    await safeAuditLog(prisma, {
        actorUserId: authResult.auth.userId,
        targetUserId: authResult.auth.userId,
        action: 'health_metric_logged',
        entityType: 'health_metric',
        entityId: metric.id,
        metadata: {
            weight,
            systolic,
            diastolic,
            hba1c,
        },
        ...requestMeta
    });

    return NextResponse.json({ metric }, { status: 201 });
}

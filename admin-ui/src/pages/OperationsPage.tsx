import { Button } from '@lingcoo/frame-ui/button';
import { useEffect, useState } from 'react';

import {
  cancelJob,
  fetchJobs,
  fetchJobSummary,
  fetchOutboxEvents,
  retryJob,
  type JobRun,
  type OutboxEvent,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { sections } from '../lib/foundation';

function jobTone(status: JobRun['status']) {
  return status === 'succeeded'
    ? ('ok' as const)
    : status === 'dead'
      ? ('danger' as const)
      : status === 'running'
        ? ('info' as const)
        : ('neutral' as const);
}

export function OperationsPage() {
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [outbox, setOutbox] = useState<OutboxEvent[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [jobResult, counts, outboxResult] = await Promise.all([
        fetchJobs(),
        fetchJobSummary(),
        fetchOutboxEvents(),
      ]);
      setJobs(jobResult.items);
      setSummary(counts);
      setOutbox(outboxResult.items);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '运行任务加载失败');
    }
  }

  useEffect(() => {
    Promise.all([fetchJobs(), fetchJobSummary(), fetchOutboxEvents()])
      .then(([jobResult, counts, outboxResult]) => {
        setJobs(jobResult.items);
        setSummary(counts);
        setOutbox(outboxResult.items);
        setError('');
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '运行任务加载失败');
      });
  }, []);

  async function operate(job: JobRun, action: 'retry' | 'cancel') {
    setBusyId(job.id);
    setError('');
    try {
      if (action === 'retry') await retryJob(job.id);
      else await cancelJob(job.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '任务操作失败');
    } finally {
      setBusyId('');
    }
  }

  const jobColumns: DataTableColumn<JobRun>[] = [
    {
      key: 'job',
      header: '任务',
      cell: (job) => (
        <div className="table-primary">
          <strong>{job.kind}</strong>
          <small>
            {job.queue} · {job.id.slice(0, 8)}
          </small>
        </div>
      ),
    },
    {
      key: 'status',
      header: '状态',
      cell: (job) => <StatusPill tone={jobTone(job.status)}>{job.status}</StatusPill>,
    },
    { key: 'attempts', header: '尝试', cell: (job) => `${job.attempts} / ${job.maxAttempts}` },
    {
      key: 'time',
      header: '创建时间',
      cell: (job) => new Date(job.createdAt).toLocaleString('zh-CN'),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (job) => (
        <div className="integration-actions">
          {job.status === 'dead' || job.status === 'cancelled' ? (
            <Button
              loading={busyId === job.id}
              onClick={() => void operate(job, 'retry')}
              size="sm"
              variant="secondary"
            >
              重试
            </Button>
          ) : null}
          {job.status === 'pending' ? (
            <Button
              loading={busyId === job.id}
              onClick={() => void operate(job, 'cancel')}
              size="sm"
              variant="ghost"
            >
              取消
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const outboxColumns: DataTableColumn<OutboxEvent>[] = [
    { key: 'topic', header: '事件', cell: (event) => <code>{event.topic}</code> },
    {
      key: 'status',
      header: '状态',
      cell: (event) => (
        <StatusPill
          tone={
            event.status === 'published' ? 'ok' : event.status === 'dead' ? 'danger' : 'neutral'
          }
        >
          {event.status}
        </StatusPill>
      ),
    },
    {
      key: 'aggregate',
      header: '聚合资源',
      cell: (event) =>
        event.aggregateType ? `${event.aggregateType} · ${event.aggregateId ?? '—'}` : '—',
    },
    {
      key: 'attempts',
      header: '尝试',
      cell: (event) => `${event.attempts} / ${event.maxAttempts}`,
    },
    {
      key: 'time',
      header: '创建时间',
      align: 'right',
      cell: (event) => new Date(event.createdAt).toLocaleString('zh-CN'),
    },
  ];

  return (
    <PageFrame section={sections.operations}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>等待执行</span>
          <strong>{summary.pending ?? 0}</strong>
          <small>可用时间到达后领取</small>
        </article>
        <article className="metric-card">
          <span>执行中</span>
          <strong>{summary.running ?? 0}</strong>
          <small>Worker 持有任务锁</small>
        </article>
        <article className="metric-card">
          <span>已成功</span>
          <strong>{summary.succeeded ?? 0}</strong>
          <small>保留结果用于审计</small>
        </article>
        <article className="metric-card">
          <span>死亡任务</span>
          <strong>{summary.dead ?? 0}</strong>
          <small>耗尽重试后人工处理</small>
        </article>
      </div>
      {error ? <p className="integration-notice error">{error}</p> : null}
      <ResourceSection
        title="后台任务"
        description="任务持久化在 PostgreSQL，Worker 通过行锁并发安全领取。"
      >
        <DataTable
          columns={jobColumns}
          emptyTitle="暂无后台任务"
          getRowKey={(job) => job.id}
          rows={jobs}
        />
      </ResourceSection>
      <ResourceSection
        title="Outbox 事件"
        description="领域事务写入的事件由 Worker 投影到通知或其他订阅者。"
      >
        <DataTable
          columns={outboxColumns}
          emptyTitle="暂无 Outbox 事件"
          getRowKey={(event) => event.id}
          rows={outbox}
        />
      </ResourceSection>
    </PageFrame>
  );
}

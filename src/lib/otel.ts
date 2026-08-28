import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import type { AnyValueMap } from "@opentelemetry/api-logs";
import { trace } from "@opentelemetry/api";
import {
  defaultResource,
  resourceFromAttributes,
} from "@opentelemetry/resources";

// OTEL_HOST, e.g. "localhost:4318" — when unset, log/tracer are no-ops.
// Signal paths are appended explicitly: these exporters post to `url` as-is.
const raw = process.env.OTEL_HOST ?? "";
const base = (raw.includes("://") ? raw : `http://${raw}`).replace(/\/$/, "");
const endpoint = base || "";

// Service name so Grafana isn't "unknown_service" — rooted in code, env
// override kept for multi-instance setups. Shared by traces and logs.
const resource = defaultResource().merge(
  resourceFromAttributes({
    "service.name": process.env.OTEL_SERVICE_NAME ?? "dimasbaguspm.dev",
  }),
);

if (endpoint) {
  const logProvider = new LoggerProvider({
    resource,
    processors: [
      new SimpleLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(logProvider);

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  });
  sdk.start();

  process.once("SIGTERM", () => {
    void Promise.allSettled([
      Promise.resolve().then(() => sdk.shutdown()),
      Promise.resolve().then(() => logProvider.shutdown()),
    ]);
  });
}

const otelLogger = logs.getLogger("dimasbaguspm.dev");
type Attrs = AnyValueMap;

export const log = {
  info: (message: string, attributes?: Attrs) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: message,
      attributes,
    }),
  warn: (message: string, attributes?: Attrs) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: "WARN",
      body: message,
      attributes,
    }),
  error: (message: string, attributes?: Attrs) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: message,
      attributes,
    }),
};

export const tracer = trace.getTracer("dimasbaguspm.dev");

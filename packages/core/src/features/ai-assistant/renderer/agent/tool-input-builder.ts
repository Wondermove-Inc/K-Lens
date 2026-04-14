import { TOOL_CLARIFY_REQUIREMENTS } from "./tool-requirements";

export interface ToolInputBuildSuccess {
  ok: true;
  normalizedValues: Record<string, string>;
  payload?: Record<string, unknown>;
}

export interface ToolInputBuildFailure {
  ok: false;
  error: string;
}

export type ToolInputBuildResult = ToolInputBuildSuccess | ToolInputBuildFailure;

type ToolInputBuilder = (values: Record<string, string>) => ToolInputBuildResult;

const trimValue = (value: string | undefined) => value?.trim() ?? "";

const parseInteger = (value: string | undefined) => {
  if (!value) {
    return { ok: false as const, error: "value is required" };
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return { ok: false as const, error: "value must be a number" };
  }

  return { ok: true as const, value: parsed };
};

const parseJsonValue = (value: string | undefined) => {
  if (!value) {
    return { ok: false as const, error: "value is required" };
  }

  try {
    const parsed = JSON.parse(value);
    return { ok: true as const, value: parsed };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
};

const TOOL_INPUT_BUILDERS: Record<string, ToolInputBuilder> = {
  createPod: (values) => {
    const namespace = trimValue(values.namespace);
    const podName = trimValue(values.pod_name);
    const image = trimValue(values.image);

    if (!namespace || !podName || !image) {
      return { ok: false, error: "createPod requires namespace, pod_name, and image." };
    }

    const podConfigurationSource = trimValue(values.pod_configuration);
    let podConfiguration: unknown;

    if (podConfigurationSource) {
      const parsed = parseJsonValue(podConfigurationSource);
      if (!parsed.ok) {
        return {
          ok: false,
          error: `Invalid pod_configuration JSON: ${parsed.error}`,
        };
      }
      podConfiguration = parsed.value;
    }

    const manifest = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: podName,
        namespace,
      },
      spec: {
        containers: [
          {
            name: podName,
            image,
          },
        ],
      },
    };

    return {
      ok: true,
      normalizedValues: {
        namespace,
        pod_name: podName,
        image,
        ...(podConfigurationSource ? { pod_configuration: podConfigurationSource } : {}),
      },
      payload: {
        action: "create_pod",
        namespace,
        name: podName,
        manifest,
        configuration: podConfiguration,
      },
    };
  },
  deletePod: (values) => {
    const namespace = trimValue(values.namespace);
    const podName = trimValue(values.pod_name);

    if (!namespace || !podName) {
      return { ok: false, error: "deletePod requires namespace and pod_name." };
    }

    return {
      ok: true,
      normalizedValues: { namespace, pod_name: podName },
      payload: { action: "delete_pod", namespace, name: podName },
    };
  },
  createDeployment: (values) => {
    const namespace = trimValue(values.namespace);
    const deploymentName = trimValue(values.deployment_name);
    const image = trimValue(values.image);
    const replicasSource = trimValue(values.replicas);
    const replicas = parseInteger(replicasSource);

    if (!namespace || !deploymentName || !image) {
      return { ok: false, error: "createDeployment requires namespace, deployment_name, and image." };
    }

    if (!replicas.ok) {
      return { ok: false, error: `Invalid replicas value: ${replicas.error}` };
    }

    const manifest = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: deploymentName,
        namespace,
      },
      spec: {
        replicas: replicas.value,
        selector: {
          matchLabels: {
            app: deploymentName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: deploymentName,
            },
          },
          spec: {
            containers: [
              {
                name: deploymentName,
                image,
              },
            ],
          },
        },
      },
    };

    return {
      ok: true,
      normalizedValues: {
        namespace,
        deployment_name: deploymentName,
        image,
        replicas: String(replicas.value),
      },
      payload: {
        action: "create_deployment",
        namespace,
        name: deploymentName,
        manifest,
      },
    };
  },
  deleteDeployment: (values) => {
    const namespace = trimValue(values.namespace);
    const deploymentName = trimValue(values.deployment_name);

    if (!namespace || !deploymentName) {
      return { ok: false, error: "deleteDeployment requires namespace and deployment_name." };
    }

    return {
      ok: true,
      normalizedValues: { namespace, deployment_name: deploymentName },
      payload: { action: "delete_deployment", namespace, name: deploymentName },
    };
  },
  createService: (values) => {
    const namespace = trimValue(values.namespace);
    const serviceName = trimValue(values.service_name);
    const portResult = parseInteger(trimValue(values.port));
    const targetPortResult = parseInteger(trimValue(values.targetPort));

    if (!namespace || !serviceName) {
      return { ok: false, error: "createService requires namespace and service_name." };
    }

    if (!portResult.ok || !targetPortResult.ok) {
      return { ok: false, error: "createService requires numeric port and targetPort values." };
    }

    const manifest = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: serviceName,
        namespace,
      },
      spec: {
        selector: {
          app: serviceName,
        },
        ports: [
          {
            port: portResult.value,
            targetPort: targetPortResult.value,
          },
        ],
      },
    };

    return {
      ok: true,
      normalizedValues: {
        namespace,
        service_name: serviceName,
        port: String(portResult.value),
        targetPort: String(targetPortResult.value),
      },
      payload: {
        action: "create_service",
        namespace,
        name: serviceName,
        manifest,
      },
    };
  },
  deleteService: (values) => {
    const namespace = trimValue(values.namespace);
    const serviceName = trimValue(values.service_name);

    if (!namespace || !serviceName) {
      return { ok: false, error: "deleteService requires namespace and service_name." };
    }

    return {
      ok: true,
      normalizedValues: { namespace, service_name: serviceName },
      payload: { action: "delete_service", namespace, name: serviceName },
    };
  },
  getPods: (values) => {
    const namespace = trimValue(values.namespace);
    if (!namespace) {
      return { ok: false, error: "getPods requires namespace." };
    }
    return {
      ok: true,
      normalizedValues: { namespace },
      payload: { action: "get_pods", namespace },
    };
  },
  getDeployments: (values) => {
    const namespace = trimValue(values.namespace);
    if (!namespace) {
      return { ok: false, error: "getDeployments requires namespace." };
    }
    return {
      ok: true,
      normalizedValues: { namespace },
      payload: { action: "get_deployments", namespace },
    };
  },
  getServices: (values) => {
    const namespace = trimValue(values.namespace);
    if (!namespace) {
      return { ok: false, error: "getServices requires namespace." };
    }
    return {
      ok: true,
      normalizedValues: { namespace },
      payload: { action: "get_services", namespace },
    };
  },
  getWarningEventsByNamespace: (values) => {
    const namespace = trimValue(values.namespace);
    if (!namespace) {
      return { ok: false, error: "getWarningEventsByNamespace requires namespace." };
    }
    return {
      ok: true,
      normalizedValues: { namespace },
      payload: { action: "get_warning_events", namespace },
    };
  },
  getNamespaces: (values) => ({
    ok: true,
    normalizedValues: values,
    payload: { action: "get_namespaces" },
  }),
};

export const buildToolInputPayload = (operation: string, values: Record<string, string>): ToolInputBuildResult => {
  const builder = TOOL_INPUT_BUILDERS[operation];

  if (!builder) {
    return {
      ok: true,
      normalizedValues: values,
    };
  }

  return builder(values);
};

export const getRequirementForOperation = (operation: string) => {
  return TOOL_CLARIFY_REQUIREMENTS.find((requirement) => requirement.operation === operation) ?? null;
};

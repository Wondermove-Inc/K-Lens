export type ToolClarifyAgent = "kubernetesOperator" | "agentAnalyzer";

export type ToolClarifySlotValueType = "string" | "number" | "json" | "multiline";

export interface ToolClarifySlot {
  id: string;
  label: string;
  description: string;
  example?: string;
  type?: ToolClarifySlotValueType;
  required?: boolean;
}

export interface ToolClarifyRequirement {
  operation: string;
  agent: ToolClarifyAgent;
  intentCategories: string[];
  slots: ToolClarifySlot[];
}

export const TOOL_CLARIFY_REQUIREMENTS: ToolClarifyRequirement[] = [
  {
    operation: "createPod",
    agent: "kubernetesOperator",
    intentCategories: ["create_pod", "deploy_pod"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace where the pod will be created",
        example: "default",
      },
      {
        id: "pod_name",
        label: "Pod Name",
        description: "Resource name for the new pod",
        example: "nginx-pod",
      },
      {
        id: "image",
        label: "Container Image",
        description: "Image to run inside the pod",
        example: "nginx:1.27",
      },
      {
        id: "pod_configuration",
        label: "Pod Configuration",
        description: "Optional JSON snippet for ports, env, or resource tuning",
        example: 'pod_configuration={"ports":[80]}',
        type: "json",
        required: false,
      },
    ],
  },
  {
    operation: "deletePod",
    agent: "kubernetesOperator",
    intentCategories: ["delete_pod", "remove_pod"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace that contains the pod",
        example: "default",
      },
      {
        id: "pod_name",
        label: "Pod Name",
        description: "Name of the pod to delete",
        example: "nginx-pod",
      },
    ],
  },
  {
    operation: "createDeployment",
    agent: "kubernetesOperator",
    intentCategories: ["create_deployment", "deploy_workload"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace where the deployment will live",
        example: "apps",
      },
      {
        id: "deployment_name",
        label: "Deployment Name",
        description: "Name of the deployment to create",
        example: "web-deploy",
      },
      {
        id: "image",
        label: "Container Image",
        description: "Image used by the deployment",
        example: "nginx:stable",
      },
      {
        id: "replicas",
        label: "Replica Count",
        description: "Desired number of replicas",
        example: "3",
      },
    ],
  },
  {
    operation: "deleteDeployment",
    agent: "kubernetesOperator",
    intentCategories: ["delete_deployment", "remove_deployment"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace that contains the deployment",
        example: "apps",
      },
      {
        id: "deployment_name",
        label: "Deployment Name",
        description: "Name of the deployment to delete",
        example: "web-deploy",
      },
    ],
  },
  {
    operation: "createService",
    agent: "kubernetesOperator",
    intentCategories: ["create_service", "expose_service"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace where the service will be created",
        example: "default",
      },
      {
        id: "service_name",
        label: "Service Name",
        description: "Name of the service to create",
        example: "web-svc",
      },
      {
        id: "port",
        label: "Service Port",
        description: "Port exposed by the service",
        example: "80",
      },
      {
        id: "targetPort",
        label: "Target Port",
        description: "Container port targeted by the service",
        example: "8080",
      },
    ],
  },
  {
    operation: "deleteService",
    agent: "kubernetesOperator",
    intentCategories: ["delete_service", "remove_service"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace that contains the service",
        example: "default",
      },
      {
        id: "service_name",
        label: "Service Name",
        description: "Name of the service to delete",
        example: "web-svc",
      },
    ],
  },
  {
    operation: "getPods",
    agent: "agentAnalyzer",
    intentCategories: ["get_pods", "list_pods", "inspect_pods", "get_pod_list"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace to inspect for pods",
        example: "default",
      },
    ],
  },
  {
    operation: "getDeployments",
    agent: "agentAnalyzer",
    intentCategories: ["get_deployments", "list_deployments"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace to inspect for deployments",
        example: "apps",
      },
    ],
  },
  {
    operation: "getServices",
    agent: "agentAnalyzer",
    intentCategories: ["get_services", "list_services"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace to inspect for services",
        example: "default",
      },
    ],
  },
  {
    operation: "getWarningEventsByNamespace",
    agent: "agentAnalyzer",
    intentCategories: ["get_warning_events", "inspect_events"],
    slots: [
      {
        id: "namespace",
        label: "Namespace",
        description: "Namespace to inspect for warning events",
        example: "production",
      },
    ],
  },
  {
    operation: "getNamespaces",
    agent: "agentAnalyzer",
    intentCategories: ["get_namespaces", "list_namespaces", "view_namespace_list"],
    slots: [],
  },
];

export const getClarifyRequirementForIntent = (intentCategory: string | null | undefined, agent?: ToolClarifyAgent) => {
  if (!intentCategory) {
    return null;
  }

  const normalized = intentCategory.trim().toLowerCase();

  return TOOL_CLARIFY_REQUIREMENTS.find(
    (requirement) =>
      requirement.intentCategories.some((category) => category.toLowerCase() === normalized) &&
      (!agent || requirement.agent === agent),
  );
};

/**
 * kubectl-style resource abbreviations mapped to navigate-to injectable IDs.
 * Used by the `:` command mode to resolve user input to resource views.
 *
 * Format: abbreviation → { injectableId, displayName, category, aliases }
 */

export interface ResourceMapping {
  injectableId: string;
  displayName: string;
  routePath: string;
  category: "Workloads" | "Network" | "Storage" | "Config" | "RBAC" | "Custom" | "Helm" | "Cluster";
  aliases: string[];
}

/**
 * All resource mappings. Each entry maps a canonical abbreviation to its
 * navigate injectable ID and metadata. The `aliases` array contains
 * additional names that should also match.
 */
export const resourceAbbreviations: Record<string, ResourceMapping> = {
  // Workloads
  po: {
    injectableId: "navigate-to-pods",
    displayName: "Pods",
    routePath: "/pods",
    category: "Workloads",
    aliases: ["pod", "pods"],
  },
  deploy: {
    injectableId: "navigate-to-deployments",
    displayName: "Deployments",
    routePath: "/deployments",
    category: "Workloads",
    aliases: ["dp", "deployment", "deployments"],
  },
  rs: {
    injectableId: "navigate-to-replicasets",
    displayName: "ReplicaSets",
    routePath: "/replicasets",
    category: "Workloads",
    aliases: ["replicaset", "replicasets"],
  },
  ds: {
    injectableId: "navigate-to-daemonsets",
    displayName: "DaemonSets",
    routePath: "/daemonsets",
    category: "Workloads",
    aliases: ["daemonset", "daemonsets"],
  },
  sts: {
    injectableId: "navigate-to-statefulsets",
    displayName: "StatefulSets",
    routePath: "/statefulsets",
    category: "Workloads",
    aliases: ["statefulset", "statefulsets"],
  },
  job: {
    injectableId: "navigate-to-jobs",
    displayName: "Jobs",
    routePath: "/jobs",
    category: "Workloads",
    aliases: ["jobs"],
  },
  cj: {
    injectableId: "navigate-to-cron-jobs",
    displayName: "CronJobs",
    routePath: "/cronjobs",
    category: "Workloads",
    aliases: ["cronjob", "cronjobs"],
  },

  // Network
  svc: {
    injectableId: "navigate-to-services",
    displayName: "Services",
    routePath: "/services",
    category: "Network",
    aliases: ["service", "services"],
  },
  ep: {
    injectableId: "navigate-to-endpoints",
    displayName: "Endpoints",
    routePath: "/endpoints",
    category: "Network",
    aliases: ["endpoint", "endpoints"],
  },
  ing: {
    injectableId: "navigate-to-ingresses",
    displayName: "Ingresses",
    routePath: "/ingresses",
    category: "Network",
    aliases: ["ingress", "ingresses"],
  },
  netpol: {
    injectableId: "navigate-to-network-policies",
    displayName: "NetworkPolicies",
    routePath: "/network-policies",
    category: "Network",
    aliases: ["networkpolicy", "networkpolicies"],
  },

  // Config
  cm: {
    injectableId: "navigate-to-config-maps",
    displayName: "ConfigMaps",
    routePath: "/configmaps",
    category: "Config",
    aliases: ["configmap", "configmaps"],
  },
  sec: {
    injectableId: "navigate-to-secrets",
    displayName: "Secrets",
    routePath: "/secrets",
    category: "Config",
    aliases: ["secret", "secrets"],
  },
  hpa: {
    injectableId: "navigate-to-horizontal-pod-autoscalers",
    displayName: "HorizontalPodAutoscalers",
    routePath: "/hpa",
    category: "Config",
    aliases: ["horizontalpodautoscaler", "horizontalpodautoscalers"],
  },
  quota: {
    injectableId: "navigate-to-resource-quotas",
    displayName: "ResourceQuotas",
    routePath: "/resourcequotas",
    category: "Config",
    aliases: ["resourcequota", "resourcequotas"],
  },
  limits: {
    injectableId: "navigate-to-limit-ranges",
    displayName: "LimitRanges",
    routePath: "/limitranges",
    category: "Config",
    aliases: ["limitrange", "limitranges"],
  },
  pdb: {
    injectableId: "navigate-to-pod-disruption-budgets",
    displayName: "PodDisruptionBudgets",
    routePath: "/poddisruptionbudgets",
    category: "Config",
    aliases: ["poddisruptionbudget", "poddisruptionbudgets"],
  },
  pc: {
    injectableId: "navigate-to-priority-classes",
    displayName: "PriorityClasses",
    routePath: "/priorityclasses",
    category: "Config",
    aliases: ["priorityclass", "priorityclasses"],
  },

  // Storage
  pv: {
    injectableId: "navigate-to-persistent-volumes",
    displayName: "PersistentVolumes",
    routePath: "/persistent-volumes",
    category: "Storage",
    aliases: ["persistentvolume", "persistentvolumes"],
  },
  pvc: {
    injectableId: "navigate-to-persistent-volume-claims",
    displayName: "PersistentVolumeClaims",
    routePath: "/persistent-volume-claims",
    category: "Storage",
    aliases: ["persistentvolumeclaim", "persistentvolumeclaims"],
  },
  sc: {
    injectableId: "navigate-to-storage-classes",
    displayName: "StorageClasses",
    routePath: "/storage-classes",
    category: "Storage",
    aliases: ["storageclass", "storageclasses"],
  },

  // RBAC
  sa: {
    injectableId: "navigate-to-service-accounts",
    displayName: "ServiceAccounts",
    routePath: "/service-accounts",
    category: "RBAC",
    aliases: ["serviceaccount", "serviceaccounts"],
  },
  role: {
    injectableId: "navigate-to-roles",
    displayName: "Roles",
    routePath: "/roles",
    category: "RBAC",
    aliases: ["roles"],
  },
  rolebinding: {
    injectableId: "navigate-to-role-bindings",
    displayName: "RoleBindings",
    routePath: "/role-bindings",
    category: "RBAC",
    aliases: ["rb", "rolebindings"],
  },
  clusterrole: {
    injectableId: "navigate-to-cluster-roles",
    displayName: "ClusterRoles",
    routePath: "/cluster-roles",
    category: "RBAC",
    aliases: ["cr", "clusterroles"],
  },
  crb: {
    injectableId: "navigate-to-cluster-role-bindings",
    displayName: "ClusterRoleBindings",
    routePath: "/cluster-role-bindings",
    category: "RBAC",
    aliases: ["clusterrolebinding", "clusterrolebindings"],
  },

  // Cluster
  node: {
    injectableId: "navigate-to-nodes",
    displayName: "Nodes",
    routePath: "/nodes",
    category: "Cluster",
    aliases: ["no", "nodes"],
  },
  ns: {
    injectableId: "navigate-to-namespaces",
    displayName: "Namespaces",
    routePath: "/namespaces",
    category: "Cluster",
    aliases: ["namespace", "namespaces"],
  },
  event: {
    injectableId: "navigate-to-events",
    displayName: "Events",
    routePath: "/events",
    category: "Cluster",
    aliases: ["ev", "events"],
  },

  // Custom Resources
  crd: {
    injectableId: "navigate-to-custom-resource-definitions",
    displayName: "CustomResourceDefinitions",
    routePath: "/crd",
    category: "Custom",
    aliases: ["customresourcedefinition", "customresourcedefinitions"],
  },

  // Helm
  helm: {
    injectableId: "navigate-to-helm-releases",
    displayName: "Helm Releases",
    routePath: "/helm/releases",
    category: "Helm",
    aliases: ["helmrelease", "helmreleases", "hr"],
  },
  chart: {
    injectableId: "navigate-to-helm-charts",
    displayName: "Helm Charts",
    routePath: "/helm/charts",
    category: "Helm",
    aliases: ["helmchart", "helmcharts"],
  },
};

/**
 * Build a reverse lookup: any alias/abbreviation → canonical abbreviation key
 */
export function buildAliasLookup(): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const [abbr, mapping] of Object.entries(resourceAbbreviations)) {
    lookup.set(abbr.toLowerCase(), abbr);
    for (const alias of mapping.aliases) {
      lookup.set(alias.toLowerCase(), abbr);
    }
    // Also map display name (lowercase)
    lookup.set(mapping.displayName.toLowerCase(), abbr);
  }

  return lookup;
}

/** Flat list of all searchable entries for the command palette. */
export function getAllResourceEntries(): Array<{
  abbreviation: string;
  mapping: ResourceMapping;
  searchTerms: string[];
}> {
  return Object.entries(resourceAbbreviations).map(([abbr, mapping]) => ({
    abbreviation: abbr,
    mapping,
    searchTerms: [abbr, ...mapping.aliases, mapping.displayName.toLowerCase()],
  }));
}

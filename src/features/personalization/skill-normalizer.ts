export const SKILL_ALIASES: Record<string, string> = {
  // Frontend
  "reactjs": "React",
  "react.js": "React",
  "react js": "React",
  "nextjs": "Next.js",
  "next.js": "Next.js",
  "vuejs": "Vue.js",
  "vue.js": "Vue.js",
  "angularjs": "Angular",
  "angular": "Angular",
  "js": "JavaScript",
  "javascript": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "html5": "HTML",
  "html": "HTML",
  "css3": "CSS",
  "css": "CSS",
  "tailwindcss": "Tailwind CSS",
  "tailwind": "Tailwind CSS",

  // Backend / Languages
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "node": "Node.js",
  "expressjs": "Express",
  "express.js": "Express",
  "express": "Express",
  "py": "Python",
  "python": "Python",
  "cpp": "C++",
  "c++": "C++",
  "golang": "Go",
  "go lang": "Go",
  "go": "Go",
  "rustlang": "Rust",
  "rust": "Rust",
  "java": "Java",
  "csharp": "C#",
  "c#": "C#",
  "ruby on rails": "Ruby on Rails",
  "rails": "Ruby on Rails",
  "ruby": "Ruby",

  // Databases
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "redis": "Redis",
  "sqlite": "SQLite",
  "mysql": "MySQL",
  "dynamodb": "DynamoDB",
  "cassandra": "Cassandra",

  // Cloud & DevOps
  "aws": "AWS",
  "amazon web services": "AWS",
  "gcp": "GCP",
  "google cloud": "GCP",
  "google cloud platform": "GCP",
  "azure": "Azure",
  "docker": "Docker",
  "k8s": "Kubernetes",
  "kubernetes": "Kubernetes",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "github actions": "GitHub Actions",
  "jenkins": "Jenkins",
  "terraform": "Terraform",

  // Concepts & Arch
  "system design": "System Design",
  "sys design": "System Design",
  "microservices": "Microservices",
  "rest api": "REST APIs",
  "restful api": "REST APIs",
  "rest": "REST APIs",
  "graphql": "GraphQL",
  "grpc": "gRPC",
  "oop": "OOP",
  "dsa": "DSA",
  "algorithms": "DSA",
  "data structures": "DSA",
  "agile": "Agile",
  "scrum": "Scrum",
};

export function normalizeSkill(skill: string): string {
  const trimmed = skill.trim();
  const lower = trimmed.toLowerCase();
  if (SKILL_ALIASES[lower]) {
    return SKILL_ALIASES[lower];
  }
  // Title-case as fallback for neat appearance if not in alias map
  return trimmed.split(/\s+/).map(word => {
    if (word.length <= 2 && word.toLowerCase() !== "go" && word.toLowerCase() !== "js" && word.toLowerCase() !== "py") {
      return word.toUpperCase(); // e.g. "AI", "ML", "UI"
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

export function normalizeSkills(skills: string[]): string[] {
  const normalized = skills.map(s => normalizeSkill(s));
  return [...new Set(normalized)];
}

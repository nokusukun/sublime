# Architectural slop

Abstraction is load-bearing at the architecture level. Every layer, service, and message bus is a long-term commitment paid in reading tax, deployment complexity, and debugging surface. Models reach for enterprise patterns reflexively because their training corpus is stuffed with blog posts that treat Clean Architecture, DDD, microservices, and CQRS as universal goods. They are not. They are answers to specific scale and coordination problems most systems do not have. The patterns below are the architectural shapes that appear when a model generates from priors instead of posture.

### Microservices-for-a-function

**Tags:** `AI-slop` | `Quality` · `Review` · `Universal`

**Pattern.** Stand up a separate deployable service for logic that a single module export would have provided.

**Forbidden example.**
```yaml
services:
  email-validator:
    image: email-validator:1.0
    ports: ["8081:8081"]
  phone-validator:
    image: phone-validator:1.0
    ports: ["8082:8082"]
  auth-gateway:
    depends_on: [email-validator, phone-validator]
```

**Why it hurts.** You just bought network latency, deployment orchestration, cross-service tracing, and a distributed systems problem to replace a function call. Microservices pay off when teams need independent deploys or components need independent scaling. A validator does neither. The architecture is pure ceremony and every on-call rotation will pay for it.

**Rewrite.**
```ts
// auth/validation.ts
export const isValidEmail = (s: string) => EMAIL_RE.test(s);
export const isValidPhone = (s: string) => PHONE_RE.test(s);
```

**See in `/sublime`:** [../sublime/SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [../sublime/references/interfaces.md](../sublime/references/interfaces.md).

---

### Clean-Architecture-7-layers-for-CRUD

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Stack Controller, UseCase, Service, Repository, Entity, DTO, and Mapper on top of a three-table CRUD app.

**Forbidden example.**
```java
UserController -> CreateUserUseCase -> UserService
  -> UserRepository -> UserEntity
  -> UserDTO <- UserMapper <- UserResponseDTO
// one POST /users endpoint, seven files, zero behavior
```

**Why it hurts.** Clean Architecture earns its keep when domain logic is complex enough to need isolation from frameworks and persistence. A CRUD endpoint has neither. Each layer is a hop the reader must follow and a seam the test suite must stub. You pay the abstraction tax forever for a benefit that never arrives. A ChatGPT-plus-Spring signature.

**Rewrite.**
```java
@PostMapping("/users")
User create(@RequestBody NewUser input) {
    return users.insert(input);
}
```

**See in `/sublime`:** [../sublime/SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans) (BAN 7), [../sublime/references/interfaces.md](../sublime/references/interfaces.md).

---

### Redux-for-local-state

**Tags:** `AI-slop` · `Review` · `Lang:TypeScript`

**Pattern.** Wire a global store, actions, reducers, and selectors to hold state read by exactly one component.

**Forbidden example.**
```ts
// store/modalSlice.ts
const slice = createSlice({
  name: "modal",
  initialState: { isOpen: false },
  reducers: { open: s => ({ isOpen: true }), close: s => ({ isOpen: false }) },
});
// used only in <Modal />
```

**Why it hurts.** Global state means every consumer everywhere can now read and mutate this value. You have paid the coordination cost of global state to solve a problem `useState` answers in one line. The action/reducer/selector triad adds three indirections between the click and the render.

**Rewrite.**
```tsx
function Modal() {
  const [isOpen, setIsOpen] = useState(false);
  // ...
}
```

**See in `/sublime`:** [../sublime/SKILL.md#data--state](../sublime/SKILL.md#data--state), [../sublime/references/data-modeling.md](../sublime/references/data-modeling.md).

---

### GraphQL-for-two-endpoints

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Install a full GraphQL server, schema, resolvers, and client codegen for an app with two read endpoints.

**Forbidden example.**
```graphql
type Query {
  user(id: ID!): User
  posts: [Post!]!
}
# + @apollo/server, schema.graphql, codegen, fragments, cache policies
```

**Why it hurts.** GraphQL pays off when clients need flexible queries across a large schema, or when many teams share one graph. Two endpoints need neither. You have added a query language, a runtime, a type generator, and a new class of N+1 bugs to replace two lines of routing.

**Rewrite.**
```ts
app.get("/users/:id", (req, res) => res.json(getUser(req.params.id)));
app.get("/posts", (req, res) => res.json(listPosts()));
```

**See in `/sublime`:** [../sublime/SKILL.md#dependencies--integration](../sublime/SKILL.md#dependencies--integration), [../sublime/references/dependencies.md](../sublime/references/dependencies.md).

---

### Enterprise-patterns-in-scripts

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Drop a DI container, repository pattern, and interface segregation into a 50-line cron script.

**Forbidden example.**
```python
container = Container()
container.register(IClock, SystemClock)
container.register(IRepository[Invoice], InvoiceRepository)
runner = container.resolve(NightlyInvoiceUseCase)
runner.execute()
# the script reads one table and emails a CSV
```

**Why it hurts.** A cron script has one caller, one environment, and a finite lifespan. DI containers exist to compose many collaborators across many tests and many deployments. None of that is present here. The ceremony makes the script longer to read than the task it performs and makes debugging a late-night page harder, not easier.

**Rewrite.**
```python
def main():
    rows = db.query("select * from invoices where due < now()")
    email(to="finance@co", attachment=to_csv(rows))

if __name__ == "__main__":
    main()
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test), [../sublime/references/interfaces.md](../sublime/references/interfaces.md).

---

### Event-driven-for-synchronous-workflow

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Wire a pub/sub bus for a three-step linear workflow that could be three function calls.

**Forbidden example.**
```ts
bus.publish("order.created", order);
// handlers in three files:
bus.on("order.created", chargePayment);
bus.on("payment.charged", reserveInventory);
bus.on("inventory.reserved", sendReceipt);
```

**Why it hurts.** Pub/sub decouples producers from consumers so they can evolve independently, scale separately, or recover from failure asynchronously. None of that is needed for "charge, reserve, email" done in one request. You have traded a readable linear trace for a scavenger hunt across three handlers with no stack trace when step two fails.

**Rewrite.**
```ts
async function placeOrder(order: Order) {
  await chargePayment(order);
  await reserveInventory(order);
  await sendReceipt(order);
}
```

**See in `/sublime`:** [../sublime/SKILL.md#control-flow--structure](../sublime/SKILL.md#control-flow--structure), [../sublime/references/control-flow.md](../sublime/references/control-flow.md).

---

### God-prompt-component

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** One 500-line component or 300-line handler generated from a single long prompt, with no extracted seams.

**Forbidden example.**
```tsx
export function Dashboard() {
  // 40 lines of state
  // 80 lines of effects and fetchers
  // 120 lines of handlers
  // 260 lines of JSX
  // 0 extracted sub-components
}
```

**Why it hurts.** Variant Systems names this the signature slop of prompt-driven generation: *"One massive component or function that does everything because it was generated from a single long prompt."* The file resists testing, review, and re-prompting alike — any future change will regenerate the whole blob and lose the diffs you cared about.

**Rewrite.**
```tsx
export function Dashboard() {
  return (
    <Layout>
      <Header />
      <Metrics />
      <RecentActivity />
    </Layout>
  );
}
```

**See in `/sublime`:** [../sublime/SKILL.md#control-flow--structure](../sublime/SKILL.md#control-flow--structure), [../sublime/references/control-flow.md](../sublime/references/control-flow.md).

---

### Copy-paste architecture

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Similar-but-slightly-different code duplicated across endpoints, so a bug fix must land in twelve places.

**Forbidden example.**
```ts
// users.ts
app.get("/users", async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const rows = await db.query("select * from users limit 20 offset ?", [(page-1)*20]);
  res.json({ data: rows, page });
});
// orders.ts, products.ts, invoices.ts: same 8 lines, slightly different SQL
```

**Why it hurts.** Documented in *Why Your Vibe-Coded Project Falls Apart* as a dominant failure mode: the model regenerates the pattern from scratch for each endpoint instead of reusing an abstraction. One day you will fix an off-by-one in pagination and it will ship half-fixed.

**Rewrite.**
```ts
app.get("/users", paginate((page) => db.query("select * from users limit 20 offset ?", [page*20])));
app.get("/orders", paginate((page) => db.query("select * from orders limit 20 offset ?", [page*20])));
```

**See in `/sublime`:** [../sublime/SKILL.md#control-flow--structure](../sublime/SKILL.md#control-flow--structure), [../sublime/references/control-flow.md](../sublime/references/control-flow.md).

export default function UsersPage() {
  return (
    <>
      <div className="dashboard-heading">
        <div><div className="eyebrow">ACCESS CONTROL</div><h1 className="page-title">Users</h1><p className="muted">Manage accounts and organization access.</p></div>
      </div>
      <section className="panel dashboard-panel">
        <div className="eyebrow">USER MANAGEMENT NOT AVAILABLE</div>
        <h2>Account administration is not exposed by the current API</h2>
        <p className="muted">The available endpoints create an organization’s initial account but do not list users, reset passwords, or deactivate accounts. No user actions are shown here to avoid implying they have been applied.</p>
      </section>
    </>
  );
}

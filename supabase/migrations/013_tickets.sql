-- Ticketing system: tickets + ticket_replies tables
-- Statuses: open, in_progress, waiting_on_client, closed
-- Priority: low, medium, high, urgent
-- Category: bug, feature_request, support, billing

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  category VARCHAR(20) NOT NULL DEFAULT 'support',
  due_date TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_tickets_client_id ON tickets(client_id);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);

-- Updated_at trigger for tickets
CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_updated_at();

-- RLS policies
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies ENABLE ROW LEVEL SECURITY;

-- Tickets: admins see all, clients see their assigned clients' tickets
CREATE POLICY "Admins can do everything with tickets"
  ON tickets FOR ALL
  USING (is_admin());

CREATE POLICY "Clients can view their tickets"
  ON tickets FOR SELECT
  USING (client_id IN (SELECT get_user_client_ids()));

CREATE POLICY "Clients can create tickets"
  ON tickets FOR INSERT
  WITH CHECK (client_id IN (SELECT get_user_client_ids()));

-- Ticket replies: admins see all, clients see non-internal replies for their tickets
CREATE POLICY "Admins can do everything with ticket replies"
  ON ticket_replies FOR ALL
  USING (is_admin());

CREATE POLICY "Clients can view non-internal replies"
  ON ticket_replies FOR SELECT
  USING (
    NOT is_internal
    AND ticket_id IN (
      SELECT id FROM tickets
      WHERE client_id IN (SELECT get_user_client_ids())
    )
  );

CREATE POLICY "Clients can create replies on their tickets"
  ON ticket_replies FOR INSERT
  WITH CHECK (
    NOT is_internal
    AND ticket_id IN (
      SELECT id FROM tickets
      WHERE client_id IN (SELECT get_user_client_ids())
    )
  );

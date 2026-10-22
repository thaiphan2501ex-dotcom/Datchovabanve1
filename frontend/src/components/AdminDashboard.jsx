import SeatMap from './SeatMap.jsx';

function AdminDashboard({
  events,
  selectedEvent,
  setSelectedEvent,
  eventForm,
  onEventChange,
  onEventSubmit,
  onEdit,
  onDelete,
  onStatusPatch,
  onHandleSeatToggle,
  seatMap,
  selectedSeats,
  isAdmin,
  venues,
}) {
  return (
    <div className="dashboard-grid admin-grid">
      <section className="panel">
        <div className="panel-header">
          <h2>{selectedEvent ? 'Edit event' : 'Create new event'}</h2>
        </div>

        <form onSubmit={onEventSubmit} className="form-grid">
          <label>
            Event title
            <input name="title" value={eventForm.title} onChange={onEventChange} placeholder="Spring festival" required />
          </label>

          <label>
            Venue
            <select name="venueId" value={eventForm.venueId} onChange={onEventChange}>
              <option value="">Select venue</option>
              {(venues || []).map((venue) => (
                <option key={venue.venue_id} value={venue.venue_id}>{venue.name}</option>
              ))}
            </select>
          </label>

          <label>
            Banner URL
            <input name="bannerUrl" value={eventForm.bannerUrl} onChange={onEventChange} placeholder="https://example.com/banner.jpg" />
          </label>

          <label>
            Status
            <select name="status" value={eventForm.status} onChange={onEventChange}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <label>
            Description
            <textarea name="description" value={eventForm.description} onChange={onEventChange} rows="4" placeholder="Describe the event" />
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button">
              {selectedEvent ? 'Update event' : 'Create event'}
            </button>
            {selectedEvent && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedEvent(null);
                  onEventChange({ target: { name: 'reset', value: '' } });
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {selectedEvent && (
        <section className="panel">
          <div className="panel-header">
            <h2>Seat plan for {selectedEvent.title}</h2>
          </div>

          <div className="seat-controls">
            <span>Selected seats: {selectedSeats.length ? selectedSeats.join(', ') : 'None yet'}</span>
          </div>

          {seatMap.length === 0 ? <p className="empty-state">No seat map loaded yet.</p> : (
            <SeatMap
              seatMap={seatMap}
              selectedSeats={selectedSeats}
              onSeatToggle={onHandleSeatToggle}
              isAdmin={isAdmin}
            />
          )}
        </section>
      )}

      <section className="panel events-panel admin-events-panel">
        <div className="panel-header">
          <h2>Events</h2>
        </div>

        <div className="event-list">
          {events.length === 0 ? (
            <p className="empty-state">No events yet.</p>
          ) : (
            events.map((eventItem) => (
              <article key={eventItem.event_id} className="event-card">
                <div className="event-banner" style={{ backgroundImage: eventItem.banner_url ? `url(${eventItem.banner_url})` : 'linear-gradient(135deg, #0f172a, #1d4ed8)' }} />
                <div className="event-body">
                  <div className="event-meta">
                    <span className="status-pill">{eventItem.status}</span>
                    <span>{eventItem.venue_name || 'Venue'}</span>
                  </div>
                  <h3>{eventItem.title}</h3>
                  <p>{eventItem.description || 'No description provided.'}</p>
                  <div className="event-actions">
                    <button type="button" className="secondary-button" onClick={() => onEdit(eventItem)}>Edit</button>
                    <button type="button" className="secondary-button" onClick={() => onDelete(eventItem.event_id)}>Delete</button>
                    <button type="button" className="primary-button small" onClick={() => onStatusPatch(eventItem.event_id, eventItem.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>
                      {eventItem.status === 'PUBLISHED' ? 'Move to draft' : 'Publish'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;

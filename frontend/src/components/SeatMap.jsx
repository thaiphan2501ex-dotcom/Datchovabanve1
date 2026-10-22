function SeatMap({ seatMap = [], selectedSeats = [], onSeatToggle, isAdmin = false }) {
  const rows = [...new Set((seatMap || []).map((seat) => seat.row_num))].sort((a, b) => {
    const order = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="seat-map-shell">
      <div className="stage-label">STAGE</div>
      {rows.map((row) => (
        <div key={row} className="seat-row">
          {(seatMap || [])
            .filter((seat) => seat.row_num === row)
            .sort((a, b) => Number(a.col_num) - Number(b.col_num))
            .map((seat) => {
              const isBooked = Boolean(seat.isBooked);
              const isSelected = selectedSeats.includes(seat.seat_code);

              return (
                <button
                  key={seat.seat_id || seat.seat_code}
                  type="button"
                  className={`seat-item ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''}`}
                  disabled={isBooked}
                  onClick={() => onSeatToggle(seat.seat_code, isBooked)}
                  title={isBooked ? `${seat.seat_code} is booked` : `${seat.seat_code}`}
                >
                  {seat.seat_code}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export default SeatMap;

export function MeasurementGuide() {
  return <details className="foot-section">
    <summary>How to measure both feet at home</summary>
    <div className="foot-section-body">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Place paper against a wall on a flat, firm surface.</li>
        <li>Stand with your heel gently against the wall and weight evenly distributed.</li>
        <li>Mark the end of your longest toe. Ask someone to help if needed.</li>
        <li>Measure from the heel line to that mark for foot length.</li>
        <li>Measure across the widest part of the forefoot for foot width.</li>
        <li>Repeat for the other foot; the two feet can differ.</li>
        <li>Record each result in cm or mm, with consistent socks, time and standing conditions.</li>
      </ol>
      <p className="field-help">The longer foot often influences sizing, but exact fit depends on the boot, construction and your preferences. Home measurements cannot guarantee shoe size or fit. These are self-reported measurements, not verified measurements or medical assessments.</p>
    </div>
  </details>;
}

function generate6DigitCodeString() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export default generate6DigitCodeString
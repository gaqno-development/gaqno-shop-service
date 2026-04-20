describe("smoke", () => {
  it("should run jest with ts-jest", () => {
    expect(1 + 1).toBe(2);
  });

  it("should have test env vars set", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.JWT_SECRET).toBeDefined();
  });
});

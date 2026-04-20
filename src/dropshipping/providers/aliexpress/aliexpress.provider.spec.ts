import { AliExpressApiError, AliExpressClient } from "./aliexpress-client";
import { AliExpressProvider } from "./aliexpress.provider";

function makeClient(): jest.Mocked<AliExpressClient> {
  return {
    call: jest.fn(),
  } as unknown as jest.Mocked<AliExpressClient>;
}

describe("AliExpressProvider", () => {
  it("search delegates to client with ds.product.search and maps response", async () => {
    const client = makeClient();
    client.call.mockResolvedValueOnce({
      total_count: 1,
      current_page_no: 1,
      page_size: 20,
      products: [
        {
          product_id: "42",
          subject: "Tênis",
          product_main_image_url: "http://img",
          target_sale_price: "10.00",
        },
      ],
    });
    const provider = new AliExpressProvider(client);

    const result = await provider.search({
      keyword: "tenis",
      shipToCountry: "BR",
      page: 1,
      pageSize: 20,
    });

    expect(client.call).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "aliexpress.ds.product.search",
        params: expect.objectContaining({
          keyword: "tenis",
          ship_to_country: "BR",
          page_no: 1,
          page_size: 20,
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].externalId).toBe("42");
  });

  it("getDetails delegates to client with ds.product.get", async () => {
    const client = makeClient();
    client.call.mockResolvedValueOnce({
      ae_item_base_info_dto: {
        product_id: "42",
        subject: "Tênis",
        detail: "",
      },
    });
    const provider = new AliExpressProvider(client);

    await provider.getDetails("42");

    expect(client.call).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "aliexpress.ds.product.get",
        params: expect.objectContaining({ product_id: "42" }),
      }),
    );
  });

  const baseRequest = {
    externalProductId: "42",
    quantity: 1,
    buyerTaxNumber: "12345678900",
    shippingAddress: {
      fullName: "Ana",
      phone: "11999",
      email: "ana@x.com",
      postalCode: "01310100",
      street: "Av. X",
      number: "1",
      neighborhood: "Centro",
      city: "SP",
      stateCode: "SP",
      countryCode: "BR",
    },
  };

  it("placeOrder returns placed when order_list is returned", async () => {
    const client = makeClient();
    client.call.mockResolvedValueOnce({
      order_list: [{ order_id: "AEO-999" }],
    });
    const provider = new AliExpressProvider(client);

    const result = await provider.placeOrder(baseRequest);

    expect(result.status).toBe("placed");
    expect(result.externalOrderId).toBe("AEO-999");
  });

  it("placeOrder returns failed with out_of_stock when API error sub_code matches", async () => {
    const client = makeClient();
    client.call.mockRejectedValueOnce(
      new AliExpressApiError("500", "business.stock-not-enough", "Out of stock"),
    );
    const provider = new AliExpressProvider(client);

    const result = await provider.placeOrder(baseRequest);

    expect(result.status).toBe("failed");
    expect(result.failureKind).toBe("out_of_stock");
  });

  it("placeOrder returns transient on rate limit errors", async () => {
    const client = makeClient();
    client.call.mockRejectedValueOnce(
      new AliExpressApiError("429", "isv.rate-limit", "Too many requests"),
    );
    const provider = new AliExpressProvider(client);

    const result = await provider.placeOrder(baseRequest);

    expect(result.status).toBe("failed");
    expect(result.failureKind).toBe("transient");
  });

  it("getTracking delegates to client with ds.order.get and maps status", async () => {
    const client = makeClient();
    client.call.mockResolvedValueOnce({ order_status: "FINISH" });
    const provider = new AliExpressProvider(client);

    const update = await provider.getTracking("AEO-1");

    expect(update.status).toBe("delivered");
  });
});

import {
  toDetail,
  toOrderCreatePayload,
  toSummary,
  toTrackingUpdate,
} from "./aliexpress.mapper";

describe("aliexpress.mapper", () => {
  describe("toSummary", () => {
    it("normalizes search item into supplier summary", () => {
      const summary = toSummary({
        product_id: "1001",
        subject: "Camiseta",
        product_main_image_url: "https://cdn/1001.jpg",
        target_sale_price: "12.50",
        target_original_price: "18.00",
        evaluate_rate: "4.7",
        lastest_volume: 420,
        store_name: "Seller X",
        ship_from_country: "CN",
      });

      expect(summary.providerCode).toBe("aliexpress");
      expect(summary.externalId).toBe("1001");
      expect(summary.priceUsd).toEqual({ min: 12.5, max: 18 });
      expect(summary.rating).toBe(4.7);
      expect(summary.ordersCount).toBe(420);
    });
  });

  describe("toDetail", () => {
    it("aggregates SKUs into min/max price and variations", () => {
      const detail = toDetail({
        ae_item_base_info_dto: {
          product_id: "1001",
          subject: "Tênis",
          detail: "<p>Ótimo</p>",
        },
        ae_multimedia_info_dto: {
          image_urls: "https://cdn/a.jpg;https://cdn/b.jpg",
        },
        ae_item_sku_info_dtos: [
          {
            sku_id: "sku-1",
            offer_sale_price: "10.00",
            sku_stock: 20,
            ae_sku_property_dtos: [
              {
                ae_sku_property_id: "1",
                property_value_definition_name: "Preto",
                property_value_id_long: 9,
                sku_property_name: "cor",
              },
            ],
          },
          {
            sku_id: "sku-2",
            offer_sale_price: "14.00",
            sku_stock: 5,
          },
        ],
        logistics_info_dto: {
          delivery_time_min: 10,
          delivery_time_max: 30,
        },
      });

      expect(detail.priceUsd).toEqual({ min: 10, max: 14 });
      expect(detail.images).toEqual(["https://cdn/a.jpg", "https://cdn/b.jpg"]);
      expect(detail.variations).toHaveLength(2);
      expect(detail.variations[0].attributes).toEqual({ cor: "Preto" });
      expect(detail.estimatedDeliveryDays).toEqual({ min: 10, max: 30 });
    });
  });

  describe("toOrderCreatePayload", () => {
    it("flattens address into single JSON field and serializes required fields", () => {
      const payload = toOrderCreatePayload({
        externalProductId: "1001",
        externalVariationId: "sku-1",
        quantity: 2,
        buyerTaxNumber: "12345678900",
        referenceId: "ORD-1",
        shippingAddress: {
          fullName: "Ana",
          phone: "11999999999",
          email: "ana@x.com",
          postalCode: "01310100",
          street: "Av. Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          stateCode: "SP",
          countryCode: "BR",
        },
      });

      expect(payload.product_id).toBe("1001");
      expect(payload.product_count).toBe("2");
      expect(payload.sku_attr).toBe("sku-1");
      expect(payload.out_order_id).toBe("ORD-1");
      const address = JSON.parse(payload.address);
      expect(address).toMatchObject({
        contact_person: "Ana",
        zip: "01310100",
        country: "BR",
        province: "SP",
        tax_number: "12345678900",
      });
    });
  });

  describe("toTrackingUpdate", () => {
    it("maps SELLER_SEND_GOODS to shipped", () => {
      const update = toTrackingUpdate("OID1", {
        order_status: "SELLER_SEND_GOODS",
        logistics_info: [
          { tracking_number: "BR123", logistics_status: "IN_TRANSIT" },
        ],
      });
      expect(update.status).toBe("shipped");
      expect(update.trackingCode).toBe("BR123");
    });

    it("maps FINISH to delivered", () => {
      const update = toTrackingUpdate("OID1", {
        order_status: "FINISH",
      });
      expect(update.status).toBe("delivered");
    });

    it("defaults unknown statuses to processing", () => {
      const update = toTrackingUpdate("OID1", {
        order_status: "UNKNOWN",
      });
      expect(update.status).toBe("processing");
    });
  });
});
